-- LockIn Phase 1 — foundation
--
-- Design invariant: the client NEVER writes to `commitments` directly.
-- `authenticated` receives SELECT only on the table; every mutation goes
-- through one of the five RPCs below, each SECURITY DEFINER, each
-- re-checking auth.uid() and the current status before touching a row.
-- This is enforced twice over: no INSERT/UPDATE/DELETE grant exists on the
-- table for `authenticated`, and RLS is enabled with no write policy, so a
-- future accidental GRANT still cannot open a hole.

create extension if not exists pgcrypto;

create table if not exists commitments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 140),
  deadline     timestamptz not null,
  status       text not null default 'draft'
               check (status in ('draft', 'locked', 'completed', 'failed')),
  signed_at    timestamptz,
  proof_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists commitments_user_status_idx
  on commitments (user_id, status);

-- used by expire_due_commitments to find overdue locked rows without a scan
create index if not exists commitments_locked_deadline_idx
  on commitments (deadline)
  where status = 'locked';

alter table commitments enable row level security;

create policy "select own commitments"
  on commitments for select
  to authenticated
  using (auth.uid() = user_id);

-- Deliberately no insert/update/delete policy: RLS default-denies writes
-- with no matching policy, independent of any GRANT below.

grant select on commitments to authenticated;
-- no insert/update/delete grant to authenticated — writes only via RPC


create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists commitments_set_updated_at on commitments;
create trigger commitments_set_updated_at
  before update on commitments
  for each row
  execute function set_updated_at();


-- ---------------------------------------------------------------------
-- RPCs — one per legal state transition. No function ever moves a row
-- backwards, and none introduces a "charged" state: draft -> locked ->
-- {completed | failed} is the whole machine.
-- ---------------------------------------------------------------------

create or replace function create_commitment_draft(p_title text, p_deadline timestamptz)
returns commitments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row commitments;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_deadline <= now() then
    raise exception 'deadline_must_be_future' using errcode = '22023';
  end if;

  insert into commitments (user_id, title, deadline, status)
  values (auth.uid(), btrim(p_title), p_deadline, 'draft')
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function lock_commitment(p_id uuid)
returns commitments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row commitments;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_row
  from commitments
  where id = p_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'draft' then
    raise exception 'invalid_transition: % -> locked', v_row.status using errcode = '22023';
  end if;
  if v_row.deadline <= now() then
    raise exception 'deadline_already_passed' using errcode = '22023';
  end if;

  update commitments
  set status = 'locked', signed_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function finalize_proof(p_id uuid, p_proof_path text)
returns commitments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row commitments;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_row
  from commitments
  where id = p_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'locked' then
    raise exception 'invalid_transition: % -> completed', v_row.status using errcode = '22023';
  end if;
  if v_row.deadline < now() then
    raise exception 'deadline_passed' using errcode = '22023';
  end if;
  if p_proof_path is null or btrim(p_proof_path) = '' then
    raise exception 'proof_path_required' using errcode = '22023';
  end if;

  update commitments
  set status = 'completed', proof_path = p_proof_path
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function delete_draft(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from commitments
  where id = p_id and user_id = auth.uid() and status = 'draft'
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'not_found_or_not_draft' using errcode = 'P0002';
  end if;
end;
$$;

-- Self-healing expiry. Called two ways:
--  1. by an authenticated client on dashboard load -> auth.uid() is set,
--     so only that user's own overdue rows flip to failed (matches
--     README: "Zonder cron expire't de app nog steeds als iemand het
--     dashboard opent.")
--  2. by pg_cron running as a privileged role with no user session ->
--     auth.uid() is null, so it sweeps every overdue row globally.
create or replace function expire_due_commitments()
returns setof commitments
language sql
security definer
set search_path = public, pg_temp
as $$
  update commitments
  set status = 'failed'
  where status = 'locked'
    and deadline < now()
    and (auth.uid() is null or user_id = auth.uid())
  returning *;
$$;

grant execute on function create_commitment_draft(text, timestamptz) to authenticated;
grant execute on function lock_commitment(uuid) to authenticated;
grant execute on function finalize_proof(uuid, text) to authenticated;
grant execute on function delete_draft(uuid) to authenticated;
grant execute on function expire_due_commitments() to authenticated;


-- ---------------------------------------------------------------------
-- Storage — bucket created now so the Phase 2 upload path has somewhere
-- to land; no upload UI ships in Phase 1 (see README).
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('commitment-proofs', 'commitment-proofs', false)
on conflict (id) do nothing;

create policy "read own proof objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'commitment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "write own proof objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'commitment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
