"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useBackButton } from "@/hooks/use-back-button";
import { cleanupOverlay } from "@/lib/overlay-stack";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navClosedAtRef = useRef(0);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
    navClosedAtRef.current = Date.now();
  }, []);

  // Close drawer after a Link navigation without calling history.back(),
  // which would undo the navigation that the Link just pushed.
  const handleNavigateClose = useCallback(() => {
    cleanupOverlay("mobile-nav");
    setMobileOpen(false);
  }, []);

  useBackButton("mobile-nav", mobileOpen, handleMobileClose);

  // Listen for pillar:back-empty — open nav on mobile if not recently closed
  useEffect(() => {
    function onBackEmpty() {
      if (window.innerWidth >= 768) return;
      if (Date.now() - navClosedAtRef.current < 500) return;
      setMobileOpen(true);
    }

    window.addEventListener("pillar:back-empty", onBackEmpty);
    return () => window.removeEventListener("pillar:back-empty", onBackEmpty);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="max-md:hidden h-full md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <Sidebar onNavigate={handleNavigateClose} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <Topbar onMenuToggle={() => setMobileOpen((o) => !o)} />

        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
