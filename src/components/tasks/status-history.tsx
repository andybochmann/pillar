"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowDown } from "lucide-react";
import type { StatusHistoryEntry, Column } from "@/types";

interface StatusHistoryProps {
  statusHistory: StatusHistoryEntry[];
  columns: Column[];
}

export function StatusHistory({ statusHistory, columns }: StatusHistoryProps) {
  if (statusHistory.length === 0) return null;

  const columnNameMap = new Map(columns.map((c) => [c.id, c.name]));

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium select-none">
        Activity ({statusHistory.length})
      </summary>
      <div className="mt-3 space-y-0">
        {[...statusHistory].reverse().map((entry, i) => (
          <div key={`${entry.columnId}-${entry.timestamp}`}>
            {i > 0 && (
              <div className="flex justify-center py-0.5">
                <ArrowDown className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <div
              data-testid="status-history-entry"
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span className="font-medium">
                {columnNameMap.get(entry.columnId) ?? entry.columnId}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
