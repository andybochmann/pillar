"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCalendarSync } from "@/hooks/use-calendar-sync";

export function CalendarSyncCard() {
  const {
    status,
    loading,
    toggling,
    disconnecting,
    toggleSync,
    disconnect,
    refresh,
  } = useCalendarSync();

  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    const calendarParam = searchParams.get("calendar");
    if (!calendarParam || handledRef.current) return;

    handledRef.current = true;

    if (calendarParam === "connected") {
      toast.success("Google Calendar connected successfully");
      refresh();
    } else if (calendarParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast.error(`Failed to connect Google Calendar: ${reason}`);
    }

    // Clean up query params to prevent duplicate toasts on refresh
    router.replace("/settings", { scroll: false });
  }, [searchParams, refresh, router]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function handleToggle(checked: boolean) {
    try {
      await toggleSync(checked);
      toast.success(
        checked
          ? "Calendar sync enabled. Syncing existing tasks..."
          : "Calendar sync disabled",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to toggle sync",
      );
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      toast.success("Google Calendar disconnected");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect",
      );
    }
  }

  if (!status.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Sync tasks with due dates to your Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/api/calendar/auth">
              <Calendar className="mr-2 h-4 w-4" />
              Connect Google Calendar
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Tasks with due dates are synced as all-day events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="calendar-sync-toggle" className="cursor-pointer">
            Sync to Google Calendar
          </Label>
          <Switch
            id="calendar-sync-toggle"
            checked={status.enabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>

        {status.syncErrors >= 3 && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="text-sm">
              <p className="font-medium text-yellow-500">
                Calendar sync has encountered errors
              </p>
              {status.lastSyncError && (
                <p className="mt-1 text-muted-foreground">{status.lastSyncError}</p>
              )}
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-yellow-500"
                asChild
              >
                <a href="/api/calendar/auth">Reconnect</a>
              </Button>
            </div>
          </div>
        )}

        {status.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(status.lastSyncAt).toLocaleString()}
          </p>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open Calendar
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
