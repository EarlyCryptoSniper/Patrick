import { useState } from "react";
import type { StakeCents } from "../../lib/types";
import { createDraft, lockCommitment } from "./api";

type Step = "title" | "deadline" | "stake" | "summary";

const STEPS: Step[] = ["title", "deadline", "stake", "summary"];
const STEP_LABEL: Record<Step, string> = {
  title: "Taak",
  deadline: "Deadline",
  stake: "Inzet",
  summary: "Samenvatting",
};

const STAKE_OPTIONS: { cents: StakeCents; label: string }[] = [
  { cents: 0, label: "Geen inzet" },
  { cents: 500, label: "€5" },
  { cents: 1000, label: "€10" },
];

function defaultDeadline(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });

export function CommitmentWizard({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [stakeCents, setStakeCents] = useState<StakeCents>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];

  function reset() {
    setOpen(false);
    setStepIndex(0);
    setTitle("");
    setDeadline(defaultDeadline());
    setStakeCents(0);
    setError(null);
  }

  function canAdvance(): boolean {
    if (step === "title") return title.trim().length > 0;
    if (step === "deadline") return new Date(deadline) > new Date();
    return true;
  }

  function goNext() {
    if (!canAdvance()) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSign() {
    setBusy(true);
    setError(null);
    try {
      const draft = await createDraft(title, new Date(deadline), stakeCents);
      await lockCommitment(draft.id);
      onCreated();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vastzetten mislukt");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-btn w-full rounded-2xl py-3 text-sm text-ink-600 hover:text-paper"
      >
        + Nieuw commitment
      </button>
    );
  }

  return (
    <div className="glass glass-door p-4">
      <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-600">
        {STEPS.map((s, i) => (
          <span key={s} className={i === stepIndex ? "text-status-locked" : i < stepIndex ? "text-ink-600" : "text-ink-700"}>
            {i > 0 && <span className="mx-1">›</span>}
            {STEP_LABEL[s]}
          </span>
        ))}
      </div>

      {step === "title" && (
        <div>
          <label htmlFor="wizard-title" className="mb-1 block text-xs uppercase tracking-wide text-ink-600">
            Wat zet je vast?
          </label>
          <input
            id="wizard-title"
            type="text"
            autoFocus
            maxLength={140}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Bijv. Voorstel af vóór vrijdag"
            className="glass w-full rounded-xl px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
          />
        </div>
      )}

      {step === "deadline" && (
        <div>
          <label htmlFor="wizard-deadline" className="mb-1 block text-xs uppercase tracking-wide text-ink-600">
            Deadline
          </label>
          <input
            id="wizard-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="glass rounded-xl px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
          />
          {!canAdvance() && <p className="mt-2 text-xs text-status-failed">Kies een moment in de toekomst.</p>}
        </div>
      )}

      {step === "stake" && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-600">Inzet (optioneel)</p>
          <div className="flex gap-2">
            {STAKE_OPTIONS.map((option) => (
              <button
                key={option.cents}
                type="button"
                onClick={() => setStakeCents(option.cents)}
                className={`glass-btn rounded-xl px-3 py-2 text-sm ${
                  stakeCents === option.cents ? "glass-btn-locked text-paper" : "text-ink-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-600">
            Er wordt niets afgeschreven. Betaling is nog niet aangesloten — dit bedrag wordt alleen getoond.
          </p>
        </div>
      )}

      {step === "summary" && (
        <div className="space-y-2 text-sm">
          <p className="text-paper">{title}</p>
          <p className="font-mono text-xs text-ink-600">deadline {dateFormatter.format(new Date(deadline))}</p>
          <p className="font-mono text-xs text-ink-600">
            inzet {stakeCents === 0 ? "geen" : `€${stakeCents / 100}`}
          </p>
          <p className="text-xs text-ink-600">
            Tekenen zet dit meteen vast (status Vastgezet). Geen weg terug.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-status-failed">{error}</p>}

      <div className="mt-4 flex justify-between gap-2">
        <div>
          {stepIndex > 0 ? (
            <button type="button" onClick={goBack} className="text-xs text-ink-600 hover:text-paper">
              ← Terug
            </button>
          ) : (
            <button type="button" onClick={reset} className="text-xs text-ink-600 hover:text-paper">
              Annuleren
            </button>
          )}
        </div>
        {step === "summary" ? (
          <button
            type="button"
            onClick={handleSign}
            disabled={busy}
            className="glass-btn glass-btn-locked rounded-xl px-4 py-2 text-xs font-medium text-paper"
          >
            {busy ? "Bezig…" : "Tekenen en vastzetten"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance()}
            className="glass-btn rounded-xl px-4 py-2 text-xs font-medium text-paper"
          >
            Volgende →
          </button>
        )}
      </div>
    </div>
  );
}
