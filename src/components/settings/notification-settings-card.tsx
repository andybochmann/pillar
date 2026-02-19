"use client";

import { useState, useEffect } from "react";
import { Bell, Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import type { NotificationPreference, DueDateReminder } from "@/types";

const DAYS_BEFORE_OPTIONS = [
  { value: 0, label: "Day of" },
  { value: 1, label: "1 day before" },
  { value: 2, label: "2 days before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "1 week before" },
  { value: 14, label: "2 weeks before" },
];

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
  "UTC",
];

function formatTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const offset = now.toLocaleString("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const match = offset.match(/GMT([+-]\d{1,2}(:\d{2})?)/);
    const offsetStr = match ? ` (${match[0]})` : "";
    return `${tz.replace(/_/g, " ")}${offsetStr}`;
  } catch {
    return tz;
  }
}

export function NotificationSettingsCard() {
  const { permission, requestPermission, isSupported } =
    useNotificationPermission();
  const { subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } =
    usePushSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(
    null,
  );

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      const data = await res.json();
      setPreferences(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load preferences",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updatePreferences(updates: Partial<NotificationPreference>) {
    if (!preferences) return;

    // Auto-include the browser's timezone so the server always has the
    // current timezone for reminder scheduling, quiet hours, etc.
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimezone && detectedTimezone !== preferences.timezone) {
      updates = { ...updates, timezone: detectedTimezone };
    }

    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update preferences");
      }

      const data = await res.json();
      setPreferences(data);
      toast.success("Preferences updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update preferences",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleBrowserPushToggle(enabled: boolean) {
    if (!enabled) {
      await pushUnsubscribe();
      await updatePreferences({ enableBrowserPush: false });
      return;
    }

    if (permission !== "granted") {
      const result = await requestPermission();
      if (result !== "granted") {
        toast.error("Browser notifications permission denied");
        return;
      }
    }

    const subscribed = await pushSubscribe();
    if (!subscribed) {
      toast.error("Failed to subscribe to push notifications");
      return;
    }

    await updatePreferences({ enableBrowserPush: true });
  }

  function handleAddReminder() {
    if (!preferences) return;
    const newReminder: DueDateReminder = { daysBefore: 1, time: "09:00" };
    const updated = [...preferences.dueDateReminders, newReminder];
    updatePreferences({ dueDateReminders: updated });
  }

  function handleRemoveReminder(index: number) {
    if (!preferences) return;
    const updated = preferences.dueDateReminders.filter((_, i) => i !== index);
    updatePreferences({ dueDateReminders: updated });
  }

  function handleUpdateReminder(
    index: number,
    field: keyof DueDateReminder,
    value: string | number,
  ) {
    if (!preferences) return;
    const updated = preferences.dueDateReminders.map((r, i) =>
      i === index ? { ...r, [field]: value } : r,
    );
    updatePreferences({ dueDateReminders: updated });
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Failed to load preferences</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Configure how and when you receive notifications about your tasks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Browser Push Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browser-push">Browser Push Notifications</Label>
              <p className="text-muted-foreground text-sm">
                Receive notifications even when the app is closed
                {!isSupported && " (Not supported in this browser)"}
              </p>
            </div>
            <Switch
              id="browser-push"
              checked={preferences.enableBrowserPush}
              onCheckedChange={handleBrowserPushToggle}
              disabled={saving || !isSupported}
            />
          </div>
        </div>

        {/* In-App Notifications */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="in-app">In-App Notifications</Label>
            <p className="text-muted-foreground text-sm">
              Show notification bell with alerts while using the app
            </p>
          </div>
          <Switch
            id="in-app"
            checked={preferences.enableInAppNotifications}
            onCheckedChange={(checked) =>
              updatePreferences({ enableInAppNotifications: checked })
            }
            disabled={saving}
          />
        </div>

        {/* Due Date Reminders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Due Date Reminders</Label>
              <p className="text-muted-foreground text-sm">
                Choose when to be reminded about upcoming due dates
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddReminder}
              disabled={saving || preferences.dueDateReminders.length >= 10}
              aria-label="Add reminder"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          {preferences.dueDateReminders.length === 0 && (
            <p className="text-muted-foreground text-sm italic">
              No reminders configured. Click &quot;Add&quot; to create one.
            </p>
          )}
          <div className="space-y-2">
            {preferences.dueDateReminders.map((reminder, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={String(reminder.daysBefore)}
                  onValueChange={(val) =>
                    handleUpdateReminder(index, "daysBefore", parseInt(val, 10))
                  }
                  disabled={saving}
                >
                  <SelectTrigger
                    className="w-[160px]"
                    aria-label={`Reminder ${index + 1} days before`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_BEFORE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-sm">at</span>
                <Input
                  type="time"
                  value={reminder.time}
                  onChange={(e) =>
                    handleUpdateReminder(index, "time", e.target.value)
                  }
                  disabled={saving}
                  className="w-[130px]"
                  aria-label={`Reminder ${index + 1} time`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveReminder(index)}
                  disabled={saving}
                  aria-label={`Remove reminder ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-3">
          <div className="space-y-0.5">
            <Label htmlFor="timezone">Timezone</Label>
            <p className="text-muted-foreground text-sm">
              Used for quiet hours and daily summary scheduling
            </p>
          </div>
          <Select
            value={preferences.timezone}
            onValueChange={(value) => updatePreferences({ timezone: value })}
            disabled={saving}
          >
            <SelectTrigger id="timezone" className="w-full">
              <Globe className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const timezones = COMMON_TIMEZONES.includes(
                  preferences.timezone,
                )
                  ? COMMON_TIMEZONES
                  : [preferences.timezone, ...COMMON_TIMEZONES];
                return timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {formatTimezoneLabel(tz)}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>

        {/* Quiet Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours">Quiet Hours</Label>
              <p className="text-muted-foreground text-sm">
                Don&apos;t send notifications during these hours
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={preferences.quietHoursEnabled}
              onCheckedChange={(checked) =>
                updatePreferences({ quietHoursEnabled: checked })
              }
              disabled={saving}
            />
          </div>

          {preferences.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="quiet-start">Start</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    updatePreferences({ quietHoursStart: e.target.value })
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiet-end">End</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    updatePreferences({ quietHoursEnd: e.target.value })
                  }
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>

        {/* Overdue Summary */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="overdue-summary">Overdue Task Summary</Label>
            <p className="text-muted-foreground text-sm">
              Get notified when tasks become overdue
            </p>
          </div>
          <Switch
            id="overdue-summary"
            checked={preferences.enableOverdueSummary}
            onCheckedChange={(checked) =>
              updatePreferences({ enableOverdueSummary: checked })
            }
            disabled={saving}
          />
        </div>

        {/* Test Notification Buttons */}
        <div className="border-muted-foreground/20 flex flex-wrap gap-3 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (isSupported && permission === "granted") {
                if (navigator.serviceWorker?.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: "SHOW_NOTIFICATION",
                    title: "Test Local Notification",
                    body: "Browser notification display is working!",
                  });
                } else {
                  new Notification("Test Local Notification", {
                    body: "Browser notification display is working!",
                    icon: "/icons/icon-192x192.png",
                  });
                }
                toast.success("Local notification sent");
              } else {
                toast.error("Browser notifications not enabled");
              }
            }}
            disabled={!isSupported || permission !== "granted"}
          >
            <Bell className="mr-2 h-4 w-4" />
            Test Local Notification
          </Button>
          {preferences.enableBrowserPush && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch("/api/push/test", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(data.error || "Push test failed");
                    return;
                  }
                  if (data.sent > 0) {
                    toast.success(data.message);
                  } else {
                    toast.error(data.message);
                  }
                } catch {
                  toast.error("Failed to send test push notification");
                }
              }}
            >
              <Bell className="mr-2 h-4 w-4" />
              Test Push Notification (Server)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
