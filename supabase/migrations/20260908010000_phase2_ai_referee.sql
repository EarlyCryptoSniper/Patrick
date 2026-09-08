-- LockIn — AI referee for photo proof
--
-- Gap found by the user: finalize_proof accepted ANY uploaded file as
-- proof, no verification at all. As long as no real money moves that's
-- low-stakes (self-attestation), but it becomes a real integrity problem
-- the moment a stake is charged for real. Fix now rather than later:
-- route finalize_proof exclusively through a server-side AI review
-- (supabase/functions/verify-proof) instead of letting the client call
-- it directly.
--
-- This tightens an existing grant rather than expanding the schema —
-- safe here because there is exactly one client (this app) and it ships
-- in lockstep with this migration; no other consumer depends on calling
-- finalize_proof directly.

revoke execute on function finalize_proof(uuid, text) from authenticated;

-- The verify-proof Edge Function calls finalize_proof using the
-- service-role key (Supabase injects SUPABASE_SERVICE_ROLE_KEY into every
-- Edge Function automatically), which bypasses grants/RLS entirely, so no
-- new grant is needed for it here.
