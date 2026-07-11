"use client";

import { useState, useCallback } from "react";

interface CalendarFeedState {
  enabled: boolean;
  url: string | null;
}

interface UseCalendarFeedReturn {
  feed: CalendarFeedState;
  loading: boolean;
  error: string | null;
  fetchFeed: () => Promise<void>;
  /** Enable the feed or regenerate the token; resolves to the new URL. */
  generateFeed: () => Promise<string | null>;
  /** Disable the feed (unset the token). */
  disableFeed: () => Promise<void>;
}

/**
 * Manages the user's iCal calendar feed URL: reading the current state,
 * generating/regenerating the secret token, and disabling the feed.
 *
 * Uses plain `fetch` (like {@link useApiTokens}) — these are settings mutations
 * that should fail loudly when offline rather than being queued.
 */
export function useCalendarFeed(): UseCalendarFeedReturn {
  const [feed, setFeed] = useState<CalendarFeedState>({
    enabled: false,
    url: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/settings/calendar-feed");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load calendar feed");
      }
      setFeed(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateFeed = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/settings/calendar-feed", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to generate calendar feed");
    }
    const data = (await res.json()) as CalendarFeedState;
    setFeed(data);
    return data.url;
  }, []);

  const disableFeed = useCallback(async () => {
    const res = await fetch("/api/settings/calendar-feed", {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to disable calendar feed");
    }
    setFeed({ enabled: false, url: null });
  }, []);

  return { feed, loading, error, fetchFeed, generateFeed, disableFeed };
}
