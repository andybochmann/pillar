/**
 * Check if we're running inside a Capacitor native shell.
 */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as Record<string, unknown>).Capacitor;
}

/**
 * Get the native platform name, or null if running in a browser.
 */
export function getNativePlatform(): "android" | "ios" | null {
  if (!isNativePlatform()) return null;
  const cap = (window as Record<string, unknown>).Capacitor as {
    getPlatform?: () => string;
  };
  const platform = cap?.getPlatform?.();
  if (platform === "android" || platform === "ios") return platform;
  return null;
}
