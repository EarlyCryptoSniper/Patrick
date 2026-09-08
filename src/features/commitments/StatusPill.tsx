import type { CommitmentStatus } from "../../lib/types";

const LABEL: Record<CommitmentStatus, string> = {
  draft: "Concept",
  locked: "Vastgezet",
  completed: "Voltooid",
  failed: "Mislukt",
};

const DOT_CLASS: Record<CommitmentStatus, string> = {
  draft: "bg-status-draft",
  locked: "bg-status-locked",
  completed: "bg-status-completed",
  failed: "bg-status-failed",
};

export function StatusPill({ status }: { status: CommitmentStatus }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs uppercase tracking-wide text-ink-600">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
