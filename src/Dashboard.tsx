import { supabase } from "./lib/supabaseClient";
import { CommitmentList } from "./features/commitments/CommitmentList";
import { CommitmentWizard } from "./features/commitments/CommitmentWizard";
import { useCommitments } from "./features/commitments/useCommitments";

export function Dashboard() {
  const { commitments, loading, error, refresh } = useCommitments();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="glass mb-8 flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
        <div>
          <h1 className="text-xl font-semibold text-paper">LockIn</h1>
          <p className="text-sm text-ink-600">Zet het vast. Geen weg terug.</p>
        </div>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="glass-btn rounded-lg px-3 py-1.5 text-xs text-ink-600 hover:text-paper"
        >
          Uitloggen
        </button>
      </header>

      <div className="mb-8">
        <CommitmentWizard onCreated={refresh} />
      </div>

      {error && (
        <p className="glass-btn glass-btn-failed mb-4 rounded-xl p-3 text-sm text-paper">
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
