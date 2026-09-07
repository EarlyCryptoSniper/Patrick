import { useState, type FormEvent } from "react";
import { createDraft } from "./api";

function defaultDeadline(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewCommitmentForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createDraft(title, new Date(deadline));
      setTitle("");
      setDeadline(defaultDeadline());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aanmaken mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label htmlFor="title" className="mb-1 block text-xs uppercase tracking-wide text-ink-600">
          Commitment
        </label>
        <input
          id="title"
          type="text"
          required
          maxLength={140}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Bijv. Voorstel af vóór vrijdag"
          className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
        />
      </div>
      <div>
        <label htmlFor="deadline" className="mb-1 block text-xs uppercase tracking-wide text-ink-600">
          Deadline
        </label>
        <input
          id="deadline"
          type="datetime-local"
          required
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-60"
      >
        {busy ? "Bezig…" : "Concept aanmaken"}
      </button>
      {error && <p className="text-xs text-status-failed sm:basis-full">{error}</p>}
    </form>
  );
}
