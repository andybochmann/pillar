"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  computeSessionDuration,
  computeTotalTrackedTime,
} from "@/lib/time-format";
import { format } from "date-fns";
import type { TimeSession } from "@/types";

interface TimeSessionsListProps {
  sessions: TimeSession[];
  onDeleteSession: (sessionId: string) => void;
}

export function TimeSessionsList({
  sessions,
  onDeleteSession,
}: TimeSessionsListProps) {
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);

  const hasActive = sessions.some((s) => !s.endedAt);

  // Tick every second if there's an active session
  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [hasActive]);

  const totalMs = computeTotalTrackedTime(sessions);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [sessions],
  );

  if (sessions.length === 0) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Time Tracking</span>
        </div>
        <p className="text-xs text-muted-foreground">No time tracked</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
        aria-label="Time Tracking"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Time Tracking</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">
          {formatDuration(totalMs)}
        </span>
      </button>

      {expanded && (
        <div className="ml-6 space-y-1">
          {sortedSessions.map((session) => (
            <SessionRow
              key={session._id}
              session={session}
              onDelete={() => onDeleteSession(session._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  onDelete,
}: {
  session: TimeSession;
  onDelete: () => void;
}) {
  const isActive = !session.endedAt;
  const durationMs = computeSessionDuration(session);
  const startDate = new Date(session.startedAt);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1 text-xs",
        isActive && "bg-green-50 dark:bg-green-950",
      )}
    >
      <span
        className="shrink-0 text-muted-foreground"
        data-testid="session-date"
      >
        {format(startDate, "MMM d")}
      </span>
      <span className="text-muted-foreground">
        {format(startDate, "h:mm a")}
        {" – "}
        {isActive ? (
          <span className="text-green-600 dark:text-green-400">In progress</span>
        ) : (
          format(new Date(session.endedAt!), "h:mm a")
        )}
      </span>
      <span
        className={cn(
          "ml-auto tabular-nums font-medium",
          isActive && "text-green-600 dark:text-green-400",
        )}
      >
        {formatDuration(durationMs)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
        aria-label="Delete session"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
