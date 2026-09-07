-- LockIn Phase 2 (partial) — stake amount, no payment
--
-- Adds a `stake_cents` field so the wizard can show/store the chosen
-- amount, WITHOUT touching money: no payment-provider call exists yet,
-- and the app's own claim ("V1 schrijft geen geld af") stays literally
-- true. Only two nonzero amounts are legal (€5 / €10, matching the
-- spec's "€5/€10"); 0 stays valid for backward compatibility with rows
-- created before this migration and any future no-stake flow.
--
-- Expand-only: no existing column is renamed or narrowed, so the
-- already-shipped Phase 1 RPCs and rows are unaffected. The one
-- superseded function (create_commitment_draft) is dropped and
-- recreated with an added, defaulted parameter rather than left as a
-- second overload, so PostgREST never has to disambiguate between two
-- versions of the same RPC name.

alter table commitments
  add column if not exists stake_cents integer not null default 0
  check (stake_cents in (0, 500, 1000));

drop function if exists create_commitment_draft(text, timestamptz);

create or replace function create_commitment_draft(
  p_title text,
  p_deadline timestamptz,
  p_stake_cents integer default 0
)
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
  if p_stake_cents not in (0, 500, 1000) then
    raise exception 'invalid_stake' using errcode = '22023';
  end if;

  insert into commitments (user_id, title, deadline, status, stake_cents)
  values (auth.uid(), btrim(p_title), p_deadline, 'draft', p_stake_cents)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function create_commitment_draft(text, timestamptz, integer) to authenticated;
