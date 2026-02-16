"use client";

import { useState, useCallback, useRef } from "react";
import { isNativePlatform, getNativePlatform } from "@/lib/capacitor";

export function useNativePush() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenersRegistered = useRef(false);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform()) return false;

    setLoading(true);
    setError(null);

    try {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      // Check and request permissions
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        setError("Push notification permission denied");
        return false;
      }

      // Set up listeners (only once)
      if (!listenersRegistered.current) {
        listenersRegistered.current = true;

        await PushNotifications.addListener("registration", async (token) => {
          const platform = getNativePlatform();
          if (!platform || !token.value) return;

          // Register the device token with our server
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform,
              deviceToken: token.value,
            }),
          });
        });

        await PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err.error);
        });

        await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (notification) => {
            const url = notification.notification.data?.url;
            if (url && typeof url === "string") {
              window.location.href = url;
            }
          },
        );
      }

      // Trigger registration (fires "registration" event with token)
      await PushNotifications.register();

      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform()) return false;

    setLoading(true);
    setError(null);

    try {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      await PushNotifications.removeAllListeners();
      listenersRegistered.current = false;

      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { subscribe, unsubscribe, loading, error };
}
