"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import type { NotificationPreference } from "@/types";

const REMINDER_OPTIONS = [
  { value: 1440, label: "1 day before" },
  { value: 60, label: "1 hour before" },
  { value: 15, label: "15 minutes before" },
];

export function NotificationSettingsCard() {
  const { permission, requestPermission, isSupported } =
    useNotificationPermission();
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
    if (enabled && permission !== "granted") {
      const result = await requestPermission();
      if (result !== "granted") {
        toast.error("Browser notifications permission denied");
        return;
      }
    }
    await updatePreferences({ enableBrowserPush: enabled });
  }

  function handleReminderTimingToggle(timing: number, checked: boolean) {
    if (!preferences) return;

    const newTimings = checked
      ? [...preferences.reminderTimings, timing].sort((a, b) => b - a)
      : preferences.reminderTimings.filter((t) => t !== timing);

    updatePreferences({ reminderTimings: newTimings });
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

        {/* Reminder Timings */}
        <div className="space-y-3">
          <Label>Reminder Timings</Label>
          <p className="text-muted-foreground text-sm">
            Choose when to receive reminders before tasks are due
          </p>
          <div className="space-y-2">
            {REMINDER_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`reminder-${option.value}`}
                  checked={preferences.reminderTimings.includes(option.value)}
                  onChange={(e) =>
                    handleReminderTimingToggle(option.value, e.target.checked)
                  }
                  disabled={saving}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label
                  htmlFor={`reminder-${option.value}`}
                  className="cursor-pointer font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Email Digest */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-digest">Email Digest</Label>
              <p className="text-muted-foreground text-sm">
                Receive summary emails of your tasks
              </p>
            </div>
            <Switch
              id="email-digest"
              checked={preferences.enableEmailDigest}
              onCheckedChange={(checked) =>
                updatePreferences({ enableEmailDigest: checked })
              }
              disabled={saving}
            />
          </div>

          {preferences.enableEmailDigest && (
            <div className="space-y-1.5">
              <Label htmlFor="digest-frequency">Frequency</Label>
              <Select
                value={preferences.emailDigestFrequency}
                onValueChange={(value) =>
                  updatePreferences({
                    emailDigestFrequency: value as "daily" | "weekly" | "none",
                  })
                }
                disabled={saving}
              >
                <SelectTrigger id="digest-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
              Daily summary of overdue tasks
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

        {/* Test Notification Button */}
        <div className="border-muted-foreground/20 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (isSupported && permission === "granted") {
                new Notification("Test Notification", {
                  body: "Your notification settings are working!",
                  icon: "/icon-192.png",
                });
                toast.success("Test notification sent");
              } else {
                toast.error("Browser notifications not enabled");
              }
            }}
            disabled={!isSupported || permission !== "granted"}
          >
            <Bell className="mr-2 h-4 w-4" />
            Send Test Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
