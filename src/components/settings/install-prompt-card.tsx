"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPromptCard() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pillar-install-dismissed") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (installed || dismissed) return;

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [installed, dismissed]);

  if (installed || dismissed || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem("pillar-install-dismissed", "true");
    setDismissed(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Install Pillar</CardTitle>
        <CardDescription>
          Install Pillar as an app for quick access and offline support
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button onClick={handleInstall}>
          <Download className="mr-2 h-4 w-4" />
          Install
        </Button>
        <Button variant="ghost" onClick={handleDismiss}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
