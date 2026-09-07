import type { CommitmentStatus } from "../../lib/types";

// Pure, server-agnostic guards used to drive the UI (disable a button
// before the round trip). The RPCs in the migration are the authoritative
// enforcement — these mirror that logic so the app never dead-ends: no
// reverse transitions, no "charged" state.

export function canLock(status: CommitmentStatus, deadline: Date, now: Date): boolean {
  return status === "draft" && deadline > now;
}

export function canDelete(status: CommitmentStatus): boolean {
  return status === "draft";
}

export function canFinalizeProof(status: CommitmentStatus, deadline: Date, now: Date): boolean {
  return status === "locked" && deadline >= now;
}

export function isOverdue(status: CommitmentStatus, deadline: Date, now: Date): boolean {
  return status === "locked" && deadline < now;
}
