import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CommandPalette } from "@/components/search/command-palette";
import { KeyboardShortcutsDialog } from "@/components/layout/keyboard-shortcuts";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <DashboardShell>{children}</DashboardShell>
      <CommandPalette />
      <KeyboardShortcutsDialog />
      <Toaster />
    </>
  );
}
