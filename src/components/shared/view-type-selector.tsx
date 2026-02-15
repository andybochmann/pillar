"use client";

import { Button } from "@/components/ui/button";
import { Columns3, ListChecks } from "lucide-react";
import type { ViewType } from "@/types";

interface ViewTypeSelectorProps {
  value: ViewType;
  onChange: (viewType: ViewType) => void;
}

export function ViewTypeSelector({ value, onChange }: ViewTypeSelectorProps) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={value === "board" ? "default" : "outline"}
        size="sm"
        className="flex-1 gap-2"
        onClick={() => onChange("board")}
      >
        <Columns3 className="h-4 w-4" />
        Board
      </Button>
      <Button
        type="button"
        variant={value === "list" ? "default" : "outline"}
        size="sm"
        className="flex-1 gap-2"
        onClick={() => onChange("list")}
      >
        <ListChecks className="h-4 w-4" />
        List
      </Button>
    </div>
  );
}
