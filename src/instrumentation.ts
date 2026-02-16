export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate VAPID configuration for push notifications
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      const missing = [
        !vapidPublicKey && "VAPID_PUBLIC_KEY",
        !vapidPrivateKey && "VAPID_PRIVATE_KEY",
        !vapidSubject && "VAPID_SUBJECT",
      ].filter(Boolean);
      console.warn(
        `[startup] Push notifications DISABLED — missing env vars: ${missing.join(", ")}. ` +
        "Generate keys with: npx web-push generate-vapid-keys",
      );
    } else {
      console.log("[startup] Push notifications configured (VAPID keys present)");
    }

    const { startNotificationWorker } = await import(
      "./lib/notification-worker"
    );
    startNotificationWorker();
  }
}
