import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/search/command-palette";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="h-full p-6">{children}</div>
      </main>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
