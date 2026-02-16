"use client";

import { StatusHistory } from "@/components/tasks/status-history";
import type { StatusHistoryEntry, Column } from "@/types";

interface TaskStatusHistorySectionProps {
  statusHistory: StatusHistoryEntry[];
  columns: Column[];
}

export function TaskStatusHistorySection({
  statusHistory,
  columns,
}: TaskStatusHistorySectionProps) {
  return <StatusHistory statusHistory={statusHistory} columns={columns} />;
}
