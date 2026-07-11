"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TimeReport } from "@/types";

interface UseTimeReportReturn {
  report: TimeReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the current user's time-tracking report for a trailing window of
 * `weeks` ISO weeks. Read-only, so it uses plain `fetch()` (not `offlineFetch`)
 * and re-fetches whenever `weeks` changes.
 */
export function useTimeReport(weeks: number): UseTimeReportReturn {
  const [report, setReport] = useState<TimeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);
  // Only the latest request may write state — guards against out-of-order
  // responses when the range changes rapidly.
  const requestId = useRef(0);

  const fetchReport = useCallback(async () => {
    if (!navigator.onLine && hasData.current) return;
    const id = ++requestId.current;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/stats/time-report?weeks=${weeks}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch time report");
      }
      const data = await res.json();
      if (id !== requestId.current) return; // superseded by a newer request
      setReport(data);
      hasData.current = true;
    } catch (err) {
      if (id !== requestId.current) return;
      // Suppress errors only while offline (keep the last report); surface real
      // online failures even after a prior successful load.
      if (navigator.onLine || !hasData.current) {
        setError((err as Error).message);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [weeks]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { report, loading, error, refresh: fetchReport };
}
