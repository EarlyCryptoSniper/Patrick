export type CommitmentStatus = "draft" | "locked" | "completed" | "failed";

export interface Commitment {
  id: string;
  user_id: string;
  title: string;
  deadline: string; // ISO timestamptz
  status: CommitmentStatus;
  signed_at: string | null;
  proof_path: string | null;
  stake_cents: number;
  created_at: string;
  updated_at: string;
}

// The wizard offers exactly these — matches the spec's "€5/€10"; 0 stays
// legal for rows created before Phase 2 and any future no-stake flow.
export const VALID_STAKES_CENTS = [0, 500, 1000] as const;
export type StakeCents = (typeof VALID_STAKES_CENTS)[number];
