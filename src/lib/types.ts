export type CommitmentStatus = "draft" | "locked" | "completed" | "failed";

export interface Commitment {
  id: string;
  user_id: string;
  title: string;
  deadline: string; // ISO timestamptz
  status: CommitmentStatus;
  signed_at: string | null;
  proof_path: string | null;
  created_at: string;
  updated_at: string;
}
