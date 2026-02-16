"use client";

import { useState, useEffect } from "react";
import { Play, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/time-format";

interface TimeTrackingButtonProps {
  taskId: string;
  isActive: boolean;
  isOtherUserActive: boolean;
  activeStartedAt?: string | null;
  onStart: (taskId: string) => void;
  onStop: (taskId: string) => void;
}

export function TimeTrackingButton({
  taskId,
  isActive,
  isOtherUserActive,
  activeStartedAt,
  onStart,
  onStop,
}: TimeTrackingButtonProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !activeStartedAt) return;

    function tick() {
      const currentElapsed = Date.now() - new Date(activeStartedAt!).getTime();
      setElapsed(currentElapsed);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [isActive, activeStartedAt]);

  if (isOtherUserActive) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground bg-muted"
        title="Another user is tracking time"
      >
        <Clock className="h-3 w-3" />
      </span>
    );
  }

  if (isActive) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStop(taskId);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
          "text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-950 dark:hover:bg-green-900",
          "transition-colors animate-pulse",
        )}
        aria-label="Stop tracking time"
      >
        <Square className="h-3 w-3 fill-current" />
        {elapsed > 0 && (
          <span className="tabular-nums">{formatDuration(elapsed)}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onStart(taskId);
      }}
      className={cn(
        "inline-flex items-center rounded-md px-1 py-0.5 text-xs",
        "text-muted-foreground hover:text-foreground hover:bg-muted",
        "transition-colors",
      )}
      aria-label="Start tracking time"
    >
      <Play className="h-3 w-3" />
    </button>
  );
}
