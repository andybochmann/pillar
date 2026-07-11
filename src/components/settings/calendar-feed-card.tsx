"use client";

import { useEffect, useState } from "react";
import { Copy, CalendarDays, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useCalendarFeed } from "@/hooks/use-calendar-feed";

export function CalendarFeedCard() {
  const { feed, fetchFeed, generateFeed, disableFeed } = useCalendarFeed();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  async function handleGenerate() {
    setBusy(true);
    try {
      await generateFeed();
      toast.success(
        feed.enabled ? "Feed URL regenerated" : "Calendar feed enabled",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate feed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      await disableFeed();
      toast.success("Calendar feed disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable feed");
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!feed.url) return;
    navigator.clipboard.writeText(feed.url);
    toast.success("Feed URL copied to clipboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Feed</CardTitle>
        <CardDescription>
          Subscribe to your tasks with due dates from Apple, Google, or Outlook
          Calendar using a private iCal (.ics) feed URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feed.enabled && feed.url ? (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Feed URL (secret address)</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 rounded px-3 py-2 text-sm break-all">
                  {feed.url}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy calendar feed URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-muted-foreground flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>
                Anyone with this URL can see your task titles and due dates. Keep
                it private. If it leaks, regenerate it to revoke the old link.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={busy}>
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Regenerate URL
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate feed URL?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The current URL will stop working immediately. Any calendar
                      app subscribed to the old URL will need the new one.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGenerate}>
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" disabled={busy}>
                    Disable feed
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable calendar feed?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The feed URL will stop working immediately and subscribed
                      calendars will no longer update.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisable}>
                      Disable
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-4 text-sm">
              <CalendarDays className="h-8 w-8 opacity-50" />
              <p>Calendar feed is not enabled</p>
            </div>
            <Button onClick={handleGenerate} disabled={busy}>
              {busy ? "Enabling…" : "Enable calendar feed"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
