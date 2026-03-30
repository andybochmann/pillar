const KEY = "pillar-last-used-project";

export function getLastUsedProject(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastUsedProject(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // localStorage unavailable (SSR, private browsing)
  }
}
