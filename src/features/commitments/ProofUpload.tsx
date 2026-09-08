import { useRef, useState } from "react";
import { uploadProof, verifyProof } from "./api";

type Status = "idle" | "uploading" | "verifying";

export function ProofUpload({ commitmentId, onFinalized }: { commitmentId: string; onFinalized: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setRejected(null);
    try {
      setStatus("uploading");
      const path = await uploadProof(commitmentId, file);
      setStatus("verifying");
      const result = await verifyProof(commitmentId, path);
      if (result.verdict === "fail") {
        setRejected(result.reason);
      } else {
        onFinalized();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uploaden mislukt");
    } finally {
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const label = status === "uploading" ? "Uploaden…" : status === "verifying" ? "Scheidsrechter kijkt mee…" : "Foto-bewijs uploaden";

  return (
    <div className="flex flex-col gap-2">
      <label className="glass-btn glass-btn-completed inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-paper">
        {label}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={status !== "idle"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="hidden"
        />
      </label>
      {rejected && (
        <p className="glass-btn glass-btn-failed rounded-lg p-2 text-xs text-paper">
          Afgekeurd: {rejected} — probeer een andere foto vóór de deadline.
        </p>
      )}
      {error && <p className="text-xs text-status-failed">{error}</p>}
    </div>
  );
}
