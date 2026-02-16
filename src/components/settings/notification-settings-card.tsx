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
import { toast } from "sonner";
import type { NotificationPreference } from "@/types";

function getErrorMessage(err: unknown, defaultMsg: string): string {
  return err instanceof Error ? err.message : defaultMsg;
}

export function NotificationSettingsCard() {
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

      // Auto-detect and sync browser timezone
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTimezone && detectedTimezone !== data.timezone) {
        fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: detectedTimezone }),
        }).catch(() => {});
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load preferences"));
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
      toast.error(getErrorMessage(err, "Failed to update preferences"));
    } finally {
      setSaving(false);
    }
  }

  async function sendTestNotification() {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          title: "Test Notification",
          message: "Your notification settings are working!",
        }),
      });

      if (!res.ok) throw new Error("Failed to send test notification");
      toast.success("Test notification sent");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send test notification"));
    }
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

        {/* Quiet Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours">Quiet Hours</Label>
              <p className="text-muted-foreground text-sm">
                Don't send notifications during these hours
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
            <Label htmlFor="overdue-summary">Overdue Task Alerts</Label>
            <p className="text-muted-foreground text-sm">
              Get notified when individual tasks become overdue
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

        {/* Daily Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="daily-summary">Daily Summary</Label>
              <p className="text-muted-foreground text-sm">
                Daily notification summarizing due and overdue tasks
              </p>
            </div>
            <Switch
              id="daily-summary"
              checked={preferences.enableDailySummary}
              onCheckedChange={(checked) =>
                updatePreferences({ enableDailySummary: checked })
              }
              disabled={saving}
            />
          </div>

          {preferences.enableDailySummary && (
            <div className="max-w-[200px] space-y-1.5">
              <Label htmlFor="daily-summary-time">Summary Time</Label>
              <Input
                id="daily-summary-time"
                type="time"
                value={preferences.dailySummaryTime}
                onChange={(e) =>
                  updatePreferences({ dailySummaryTime: e.target.value })
                }
                disabled={saving}
              />
            </div>
          )}
        </div>

        {/* Test Notification Button */}
        <div className="border-muted-foreground/20 border-t pt-4">
          <Button
            variant="outline"
            onClick={sendTestNotification}
            disabled={saving}
          >
            <Bell className="mr-2 h-4 w-4" />
            Send Test Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
