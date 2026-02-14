"use client";

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </Button>
      <span className="text-lg font-bold">Pillar</span>
    </header>
  );
}
