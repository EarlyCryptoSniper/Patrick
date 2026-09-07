import type { Commitment } from "../../lib/types";
import { CommitmentCard } from "./CommitmentCard";

export function CommitmentList({
  commitments,
  onChanged,
}: {
  commitments: Commitment[];
  onChanged: () => void;
}) {
  if (commitments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-700 p-6 text-center text-sm text-ink-600">
        Nog geen commitments. Zet er hierboven één neer.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {commitments.map((commitment) => (
        <CommitmentCard key={commitment.id} commitment={commitment} onChanged={onChanged} />
      ))}
    </ul>
  );
}
