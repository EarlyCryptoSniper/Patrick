import { supabase } from "../../lib/supabaseClient";
import type { Commitment, StakeCents } from "../../lib/types";
import { buildProofPath } from "./proofPath";

// The only module allowed to call supabase.rpc for commitment mutations,
// and the only module allowed to touch supabase.storage for proof photos.
// scripts/check-write-boundary.mjs fails the build if a table write shows
// up anywhere else in src/ — the DB grants back this up (see the
// migrations), this just catches the mistake before it ships. Storage
// writes aren't covered by that script (they're not `.insert(`-shaped),
// but the same single-entry-point discipline applies: UI components never
// import `supabase` directly.

export async function listCommitments(): Promise<Commitment[]> {
  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Commitment[];
}

export async function createDraft(
  title: string,
  deadline: Date,
  stakeCents: StakeCents = 0,
): Promise<Commitment> {
  const { data, error } = await supabase.rpc("create_commitment_draft", {
    p_title: title,
    p_deadline: deadline.toISOString(),
    p_stake_cents: stakeCents,
  });
  if (error) throw error;
  return data as Commitment;
}

export async function lockCommitment(id: string): Promise<Commitment> {
  const { data, error } = await supabase.rpc("lock_commitment", { p_id: id });
  if (error) throw error;
  return data as Commitment;
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_draft", { p_id: id });
  if (error) throw error;
}

export interface ProofVerdict {
  verdict: "pass" | "fail";
  reason: string;
  commitment?: Commitment;
}

// The AI referee — the only path left that can move a commitment from
// locked to completed. finalize_proof's authenticated grant was revoked
// (20260908010000_phase2_ai_referee.sql); only the verify-proof Edge
// Function, using the service-role key, can still call it, and only
// after an OpenAI vision model judges the photo plausible for the task.
export async function verifyProof(commitmentId: string, proofPath: string): Promise<ProofVerdict> {
  const { data, error } = await supabase.functions.invoke("verify-proof", {
    body: { commitment_id: commitmentId, path: proofPath },
  });
  if (error) {
    let reason = error.message;
    try {
      const body = await (error as { context: Response }).context.json();
      if (body?.reason) reason = body.reason;
      else if (body?.error) reason = body.error;
    } catch {
      // context wasn't readable JSON — fall back to error.message above
    }
    throw new Error(reason);
  }
  return data as ProofVerdict;
}

// Uploads to the private `commitment-proofs` bucket under the caller's own
// `{user_id}/...` prefix — the only prefix the Phase 1 migration's storage
// RLS policies allow this user to write to. Returns the path so the
// caller can pass it straight to finalizeProof.
export async function uploadProof(commitmentId: string, file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const path = buildProofPath(user.id, commitmentId, file, crypto.randomUUID());
  const { error } = await supabase.storage.from("commitment-proofs").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function expireDueCommitments(): Promise<Commitment[]> {
  const { data, error } = await supabase.rpc("expire_due_commitments");
  if (error) throw error;
  return (data ?? []) as Commitment[];
}
