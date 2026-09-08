import { useEffect, useRef, useState } from "react";
import { uploadProof, verifyProof } from "./api";

type Phase = "idle" | "camera" | "uploading" | "verifying";

// Deliberately no <input type="file">: that would let someone pick an old
// photo from their library, and `capture="environment"` is only a hint —
// most browsers ignore it and open a plain file picker anyway. Capturing
// straight from getUserMedia is the only path, so there is no "choose an
// existing file" option to route around.
export function ProofUpload({ commitmentId, onFinalized }: { commitmentId: string; onFinalized: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  useEffect(() => {
    if (phase === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function openCamera() {
    setError(null);
    setRejected(null);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setPhase("camera");
    } catch {
      setError("Geen camera beschikbaar — bewijs moet live gemaakt worden, oude foto's zijn niet toegestaan.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function cancelCamera() {
    stopCamera();
    setPhase("idle");
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopCamera();

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError("Foto maken mislukt");
          setPhase("idle");
          return;
        }
        const file = new File([blob], "bewijs.jpg", { type: "image/jpeg" });
        try {
          setPhase("uploading");
          const path = await uploadProof(commitmentId, file);
          setPhase("verifying");
          const result = await verifyProof(commitmentId, path);
          if (result.verdict === "fail") setRejected(result.reason);
          else onFinalized();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Uploaden mislukt");
        } finally {
          setPhase("idle");
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  if (phase === "camera") {
    return (
      <div className="glass flex flex-col gap-3 rounded-xl p-3">
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={capture}
            className="glass-btn glass-btn-completed rounded-lg px-3 py-1.5 text-xs font-medium text-paper"
          >
            Maak foto
          </button>
          <button
            type="button"
            onClick={cancelCamera}
            className="glass-btn rounded-lg px-3 py-1.5 text-xs text-ink-600"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  const label =
    phase === "uploading" ? "Uploaden…" : phase === "verifying" ? "Scheidsrechter kijkt mee…" : "Foto-bewijs maken";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={openCamera}
        disabled={phase !== "idle"}
        className="glass-btn glass-btn-completed inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-paper"
      >
        {label}
      </button>
      {rejected && (
        <p className="glass-btn glass-btn-failed rounded-lg p-2 text-xs text-paper">
          Afgekeurd: {rejected} — probeer een nieuwe foto vóór de deadline.
        </p>
      )}
      {error && <p className="text-xs text-status-failed">{error}</p>}
    </div>
  );
}
