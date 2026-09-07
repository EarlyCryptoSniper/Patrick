import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { SignIn } from "./features/auth/SignIn";
import { Dashboard } from "./Dashboard";

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-600">Laden…</div>;
  }

  return session ? <Dashboard /> : <SignIn />;
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
