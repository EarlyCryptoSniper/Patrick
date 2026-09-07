import { useCallback, useEffect, useState } from "react";
import type { Commitment } from "../../lib/types";
import { expireDueCommitments, listCommitments } from "./api";

interface CommitmentsState {
  commitments: Commitment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCommitments(): CommitmentsState {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      // Self-heal first: this is the "someone opens the dashboard" expiry
      // path the README describes as the fallback when pg_cron is off.
      await expireDueCommitments();
      setCommitments(await listCommitments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { commitments, loading, error, refresh };
}
