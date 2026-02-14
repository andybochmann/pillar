"use client";

import { Menu, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        className="h-9 w-9"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
          <FolderKanban className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Pillar</span>
      </div>
    </header>
  );
}
