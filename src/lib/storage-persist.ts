type PersistResult = "granted" | "denied" | "unsupported";

export async function requestPersistentStorage(): Promise<PersistResult> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return "unsupported";
  }

  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) return "granted";

  const granted = await navigator.storage.persist();
  return granted ? "granted" : "denied";
}
