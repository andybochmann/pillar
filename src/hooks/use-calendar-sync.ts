"use client";

// Uses plain fetch (not offlineFetch) — calendar sync is inherently online-only,
// so offline queuing these mutations would be misleading.
import { useState, useEffect, useCallback } from "react";
import type { CalendarSyncStatus } from "@/types";

const defaultStatus: CalendarSyncStatus = {
  connected: false,
  enabled: false,
  calendarId: "primary",
  syncErrors: 0,
};

export function useCalendarSync() {
  const [status, setStatus] = useState<CalendarSyncStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/calendar");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Silently fail — status stays default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleSync = useCallback(async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await fetch("/api/settings/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setStatus(await res.json());
        return true;
      }
      const data = await res.json();
      throw new Error(data.error || "Failed to toggle sync");
    } finally {
      setToggling(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/settings/calendar", { method: "DELETE" });
      if (res.ok) {
        setStatus(defaultStatus);
        return true;
      }
      const data = await res.json();
      throw new Error(data.error || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }, []);

  return {
    status,
    loading,
    toggling,
    disconnecting,
    toggleSync,
    disconnect,
    refresh: fetchStatus,
  };
}
