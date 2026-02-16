import webpush from "web-push";
import { PushSubscription } from "@/models/push-subscription";
import { isFirebaseConfigured, sendFcmNotification } from "@/lib/firebase-admin";

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
 * Routes web subscriptions via Web Push and native subscriptions via FCM.
 * Handles 410 Gone by deleting expired subscriptions.
 * Returns the number of successfully sent notifications.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const webPushReady = isWebPushConfigured();
  const fcmReady = isFirebaseConfigured();

  if (!webPushReady && !fcmReady) return 0;

  const subscriptions = await PushSubscription.find({ userId });
  if (subscriptions.length === 0) return 0;

  if (webPushReady) {
    ensureVapidInitialized();
  }

  const webSubs = subscriptions.filter(
    (s) => s.platform === "web" && s.endpoint && s.keys,
  );
  const nativeSubs = subscriptions.filter(
    (s) => s.platform !== "web" && s.deviceToken,
  );

  const payloadStr = JSON.stringify(payload);

  // Send to web subscriptions via Web Push
  const webResults = webPushReady
    ? await Promise.allSettled(
        webSubs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint!,
                keys: { p256dh: sub.keys!.p256dh, auth: sub.keys!.auth },
              },
              payloadStr,
            );
            return true;
          } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number }).statusCode;
            if (statusCode === 410 || statusCode === 404) {
              await PushSubscription.deleteOne({ _id: sub._id });
            }
            throw err;
          }
        }),
      )
    : [];

  // Send to native subscriptions via FCM
  const nativeResults = fcmReady
    ? await Promise.allSettled(
        nativeSubs.map(async (sub) => {
          try {
            await sendFcmNotification(sub.deviceToken!, payload);
            return true;
          } catch (err: unknown) {
            const errorCode = (err as { code?: string }).code;
            if (
              errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-registration-token"
            ) {
              await PushSubscription.deleteOne({ _id: sub._id });
            }
            throw err;
          }
        }),
      )
    : [];

  const allResults = [...webResults, ...nativeResults];
  return allResults.filter((r) => r.status === "fulfilled").length;
}
