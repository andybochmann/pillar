import type { TimeSession } from "@/types";

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
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
