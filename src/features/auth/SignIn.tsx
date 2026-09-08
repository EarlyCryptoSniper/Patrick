import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";

type Mode = "password" | "magic-link";
type PasswordAction = "sign-in" | "sign-up";

export function SignIn() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<PasswordAction | "magic-link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function handlePassword(action: PasswordAction) {
    setBusy(action);
    setError(null);

    const call =
      action === "sign-in"
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({ email: email.trim(), password });

    const { data, error: authError } = await call;

    if (authError) {
      setError(authError.message);
      setBusy(null);
      return;
    }
    if (action === "sign-up" && !data.session) {
      // Email confirmation is still required for this project.
      setSignedUp(true);
    }
    setBusy(null);
  }

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setBusy("magic-link");
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim() });

    if (authError) {
      setError(authError.message);
      setBusy(null);
      return;
    }
    setMagicLinkSent(true);
    setBusy(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass glass-door w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-paper">LockIn</h1>
        <p className="mt-2 text-sm text-ink-600">
          Geen kansspel. Geen pot, geen odds, geen winst van anderen.
        </p>

        <div className="mt-8 flex gap-4 border-b border-white/10 pb-2 font-mono text-xs uppercase tracking-wide">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            className={mode === "password" ? "text-status-locked" : "text-ink-600"}
          >
            Wachtwoord
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("magic-link");
              setError(null);
            }}
            className={mode === "magic-link" ? "text-status-locked" : "text-ink-600"}
          >
            Magic link
          </button>
        </div>

        {mode === "password" ? (
          signedUp ? (
            <p className="glass mt-6 rounded-xl p-4 text-sm text-paper">
              Account aangemaakt — check je mail om <strong>{email}</strong> te bevestigen voordat je
              kunt inloggen.
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handlePassword("sign-in");
              }}
              className="mt-6 flex flex-col gap-3"
            >
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
                className="glass rounded-xl px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
              />
              <label htmlFor="password" className="text-xs uppercase tracking-wide text-ink-600">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimaal 6 tekens"
                className="glass rounded-xl px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="glass-btn glass-btn-locked flex-1 rounded-xl px-3 py-2 text-sm font-medium text-paper"
                >
                  {busy === "sign-in" ? "Bezig…" : "Inloggen"}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePassword("sign-up")}
                  disabled={busy !== null}
                  className="glass-btn flex-1 rounded-xl px-3 py-2 text-sm font-medium text-ink-600"
                >
                  {busy === "sign-up" ? "Bezig…" : "Account aanmaken"}
                </button>
              </div>
              {error && <p className="text-sm text-status-failed">{error}</p>}
            </form>
          )
        ) : magicLinkSent ? (
          <p className="glass mt-6 rounded-xl p-4 text-sm text-paper">
            Check je mail — we hebben een inloglink gestuurd naar <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={handleMagicLink} className="mt-6 flex flex-col gap-3">
            <label htmlFor="magic-email" className="text-xs uppercase tracking-wide text-ink-600">
              E-mailadres
            </label>
            <input
              id="magic-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jij@bedrijf.nl"
              className="glass rounded-xl px-3 py-2 text-sm text-paper outline-none focus:border-status-locked"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="glass-btn glass-btn-locked mt-2 rounded-xl px-3 py-2 text-sm font-medium text-paper"
            >
              {busy === "magic-link" ? "Bezig…" : "Stuur inloglink"}
            </button>
            {error && <p className="text-sm text-status-failed">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
