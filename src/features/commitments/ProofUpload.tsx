import { useRef, useState } from "react";
import { finalizeProof, uploadProof } from "./api";

export function ProofUpload({ commitmentId, onFinalized }: { commitmentId: string; onFinalized: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadProof(commitmentId, file);
      await finalizeProof(commitmentId, path);
      onFinalized();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uploaden mislukt");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-status-completed hover:text-paper">
        {busy ? "Bezig…" : "Foto-bewijs uploaden"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="hidden"
        />
      </label>
      {error && <p className="text-xs text-status-failed">{error}</p>}
    </div>
  );
}
