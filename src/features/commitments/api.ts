import { supabase } from "../../lib/supabaseClient";
import type { Commitment } from "../../lib/types";

// The only module allowed to call supabase.rpc for commitment mutations.
// scripts/check-write-boundary.mjs fails the build if a write shows up
// anywhere else in src/ — the DB grants back this up (see the migration),
// this just catches the mistake before it ships.

export async function listCommitments(): Promise<Commitment[]> {
  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Commitment[];
}

export async function createDraft(title: string, deadline: Date): Promise<Commitment> {
  const { data, error } = await supabase.rpc("create_commitment_draft", {
    p_title: title,
    p_deadline: deadline.toISOString(),
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

// Backend contract exists in Phase 1 (matches the migration); no UI calls
// it yet, since the photo-upload flow itself is explicitly Phase 2.
export async function finalizeProof(id: string, proofPath: string): Promise<Commitment> {
  const { data, error } = await supabase.rpc("finalize_proof", {
    p_id: id,
    p_proof_path: proofPath,
  });
  if (error) throw error;
  return data as Commitment;
}

export async function expireDueCommitments(): Promise<Commitment[]> {
  const { data, error } = await supabase.rpc("expire_due_commitments");
  if (error) throw error;
  return (data ?? []) as Commitment[];
}
