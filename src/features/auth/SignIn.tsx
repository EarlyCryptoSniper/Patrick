import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-paper">LockIn</h1>
      <p className="mt-2 text-sm text-ink-600">
        Geen kansspel. Geen pot, geen odds, geen winst van anderen.
      </p>

      {status === "sent" ? (
        <p className="mt-8 rounded-md border border-ink-700 bg-ink-900 p-4 text-sm text-paper">
          Check je mail — we hebben een inloglink gestuurd naar <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <label htmlFor="email" className="text-xs uppercase tracking-wide text-ink-600">
            E-mailadres
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jij@bedrijf.nl"
            className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-2 rounded-md bg-status-locked px-3 py-2 text-sm font-medium text-ink-950 disabled:opacity-60"
          >
            {status === "sending" ? "Bezig…" : "Stuur inloglink"}
          </button>
          {status === "error" && (
            <p className="text-sm text-status-failed">{errorMessage}</p>
          )}
        </form>
      )}
    </div>
  );
}
