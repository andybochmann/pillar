import type { TimeSession } from "@/types";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours === 0) return `${minutes}m ${seconds}s`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export function computeSessionDuration(session: TimeSession): number {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt
    ? new Date(session.endedAt).getTime()
    : Date.now();
  return end - start;
}

export function computeTotalTrackedTime(sessions: TimeSession[]): number {
  return sessions.reduce(
    (total, session) => total + computeSessionDuration(session),
    0,
  );
}
