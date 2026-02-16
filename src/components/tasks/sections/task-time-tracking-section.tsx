"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Square, Play } from "lucide-react";
import { TimeSessionsList } from "@/components/tasks/time-sessions-list";
import type { TimeSession } from "@/types";

interface TaskTimeTrackingSectionProps {
  taskId: string;
  timeSessions: TimeSession[];
  currentUserId?: string;
  onStartTracking?: (taskId: string) => void;
  onStopTracking?: (taskId: string) => void;
  onDeleteSession?: (taskId: string, sessionId: string) => void;
}

export function TaskTimeTrackingSection({
  taskId,
  timeSessions,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onDeleteSession,
}: TaskTimeTrackingSectionProps) {
  if (!currentUserId) {
    return null;
  }

  const activeSession = timeSessions.find(
    (s) => s.userId === currentUserId && !s.endedAt,
  );

  return (
    <>
      <Separator />
      <div className="space-y-2">
        {onStartTracking && onStopTracking && (
          <>
            {activeSession ? (
              <Button
                variant="outline"
                className="w-full text-green-600"
                onClick={() => onStopTracking(taskId)}
              >
                <Square className="mr-2 h-4 w-4 fill-current" />
                Stop Tracking
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onStartTracking(taskId)}
              >
                <Play className="mr-2 h-4 w-4" />
                Start Tracking
              </Button>
            )}
          </>
        )}
        <TimeSessionsList
          sessions={timeSessions}
          onDeleteSession={(sessionId) =>
            onDeleteSession?.(taskId, sessionId)
          }
        />
      </div>
    </>
  );
}
