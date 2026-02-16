import webpush from "web-push";
import { PushSubscription } from "@/models/push-subscription";

/**
 * Check if VAPID environment variables are configured.
 */
export function isWebPushConfigured(): boolean {
  return (
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY &&
    !!process.env.VAPID_SUBJECT
  );
}

/**
 * Get the VAPID public key for client-side subscription.
 */
export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

let vapidInitialized = false;

function ensureVapidInitialized(): void {
  if (vapidInitialized) return;
  if (!isWebPushConfigured()) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidInitialized = true;
}

interface PushPayload {
  title: string;
  message: string;
  notificationId?: string;
  taskId?: string;
  tag?: string;
  url?: string;
}

/**
 * Send a push notification to all subscriptions for a user.
 * Handles 410 Gone by deleting expired subscriptions.
 * Returns the number of successfully sent notifications.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!isWebPushConfigured()) return 0;

  ensureVapidInitialized();

  const subscriptions = await PushSubscription.find({ userId });
  if (subscriptions.length === 0) return 0;

  const payloadStr = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          payloadStr,
        );
        return true;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 or 410 means the subscription is no longer valid
        if (statusCode === 410 || statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
        throw err;
      }
    }),
  );

  return results.filter((r) => r.status === "fulfilled").length;
}
