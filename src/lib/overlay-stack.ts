interface OverlayEntry {
  id: string;
  close: () => void;
}

const stack: OverlayEntry[] = [];
let counter = 0;
let suppressCount = 0;

export function pushOverlay(id: string, close: () => void): void {
  stack.push({ id, close });
  counter++;
  window.history.pushState({ pillarOverlay: counter }, "");
}

export function removeOverlay(id: string): void {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);
  suppressCount++;
  window.history.back();
}

export function cleanupOverlay(id: string): void {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);
}

export function getStackSize(): number {
  return stack.length;
}

function handlePopState(): void {
  if (suppressCount > 0) {
    suppressCount--;
    return;
  }

  if (stack.length > 0) {
    const entry = stack.pop()!;
    entry.close();
  } else {
    window.dispatchEvent(new CustomEvent("pillar:back-empty"));
  }
}

/** Reset all state. For tests only. */
export function _reset(): void {
  stack.length = 0;
  counter = 0;
  suppressCount = 0;
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", handlePopState);
}
