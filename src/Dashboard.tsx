import { supabase } from "./lib/supabaseClient";
import { CommitmentList } from "./features/commitments/CommitmentList";
import { CommitmentWizard } from "./features/commitments/CommitmentWizard";
import { useCommitments } from "./features/commitments/useCommitments";

export function Dashboard() {
  const { commitments, loading, error, refresh } = useCommitments();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-paper">LockIn</h1>
          <p className="text-sm text-ink-600">Zet het vast. Geen weg terug.</p>
        </div>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="text-xs text-ink-600 underline decoration-ink-700 underline-offset-4 hover:text-paper"
        >
          Uitloggen
        </button>
      </header>

      <div className="mb-8">
        <CommitmentWizard onCreated={refresh} />
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-status-failed/40 bg-status-failed/10 p-3 text-sm text-status-failed">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-600">Laden…</p>
      ) : (
        <CommitmentList commitments={commitments} onChanged={refresh} />
      )}
    </div>
  );
}
