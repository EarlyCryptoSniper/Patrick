import { useState } from "react";
import type { Commitment } from "../../lib/types";
import { deleteDraft, lockCommitment } from "./api";
import { ProofUpload } from "./ProofUpload";
import { canDelete, canFinalizeProof, canLock, isOverdue } from "./stateMachine";
import { StatusPill } from "./StatusPill";

const formatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function CommitmentCard({
  commitment,
  onChanged,
}: {
  commitment: Commitment;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deadline = new Date(commitment.deadline);
  const now = new Date();

  async function handleLock() {
    setBusy(true);
    setError(null);
    try {
      await lockCommitment(commitment.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vastzetten mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteDraft(commitment.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-paper">{commitment.title}</h3>
        <div className="flex items-center gap-2">
          {commitment.stake_cents > 0 && (
            <span className="font-mono text-xs text-status-locked">€{commitment.stake_cents / 100}</span>
          )}
          <StatusPill status={commitment.status} />
        </div>
      </div>

      <p className="font-mono text-xs text-ink-600">
        deadline&nbsp;
        <time dateTime={commitment.deadline}>{formatter.format(deadline)}</time>
        {isOverdue(commitment.status, deadline, now) && (
          <span className="ml-2 text-status-failed">verlopen — wordt bijgewerkt</span>
        )}
      </p>

      {canFinalizeProof(commitment.status, deadline, now) && (
        <ProofUpload commitmentId={commitment.id} onFinalized={onChanged} />
      )}

      {(canLock(commitment.status, deadline, now) || canDelete(commitment.status)) && (
        <div className="flex gap-2">
          {canLock(commitment.status, deadline, now) && (
            <button
              type="button"
              onClick={handleLock}
              disabled={busy}
              className="glass-btn glass-btn-locked rounded-lg px-3 py-1.5 text-xs font-medium text-paper"
            >
              Vastzetten
            </button>
          )}
          {canDelete(commitment.status) && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="glass-btn rounded-lg px-3 py-1.5 text-xs font-medium text-ink-600"
            >
              Verwijderen
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-status-failed">{error}</p>}
    </li>
  );
}
