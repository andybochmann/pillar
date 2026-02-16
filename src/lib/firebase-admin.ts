import { type App, type ServiceAccount, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let firebaseApp: App | null = null;

/**
 * Check if Firebase is configured via environment variables.
 */
export function isFirebaseConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
}

function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  const existing = getApps();
  if (existing.length > 0) {
    firebaseApp = existing[0];
    return firebaseApp;
  }

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!;
  const json = Buffer.from(base64, "base64").toString("utf-8");
  const serviceAccount = JSON.parse(json) as ServiceAccount;

  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });

  return firebaseApp;
}

interface FcmPayload {
  title: string;
  message: string;
  notificationId?: string;
  taskId?: string;
  tag?: string;
  url?: string;
}

/**
 * Send a push notification to a native device via Firebase Cloud Messaging.
 * Returns true on success, false on failure.
 */
export async function sendFcmNotification(
  deviceToken: string,
  payload: FcmPayload,
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  const app = getFirebaseApp();
  const messaging = getMessaging(app);

  await messaging.send({
    token: deviceToken,
    notification: {
      title: payload.title,
      body: payload.message,
    },
    data: {
      ...(payload.notificationId && { notificationId: payload.notificationId }),
      ...(payload.taskId && { taskId: payload.taskId }),
      ...(payload.tag && { tag: payload.tag }),
      ...(payload.url && { url: payload.url }),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "pillar-default",
        clickAction: "OPEN_APP",
      },
    },
  });

  return true;
}
