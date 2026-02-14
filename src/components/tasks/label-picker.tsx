"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Label } from "@/types";

export const COLOR_PRESETS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
] as const;

interface LabelPickerProps {
  labels: Label[];
  selectedLabels: string[];
  onToggle: (labelName: string) => void;
  onCreate: (data: { name: string; color: string }) => Promise<void>;
}

export function LabelPicker({
  labels,
  selectedLabels,
  onToggle,
  onCreate,
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(COLOR_PRESETS[0]);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await onCreate({ name: trimmed, color: newColor });
      setNewName("");
      setNewColor(COLOR_PRESETS[0]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selectedLabels.map((name) => {
          const label = labels.find((l) => l.name === name);
          return (
            <Badge
              key={name}
              variant="secondary"
              className="cursor-pointer"
              style={
                label
                  ? {
                      backgroundColor: label.color + "20",
                      color: label.color,
                      borderColor: label.color,
                    }
                  : undefined
              }
              onClick={() => onToggle(name)}
            >
              {name} ×
            </Badge>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Manage labels">
            + Labels
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {labels.map((label) => (
              <label
                key={label._id}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-accent"
              >
                <Checkbox
                  checked={selectedLabels.includes(label.name)}
                  onCheckedChange={() => onToggle(label.name)}
                  aria-label={`Toggle ${label.name}`}
                />
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="text-sm truncate">{label.name}</span>
              </label>
            ))}
            {labels.length === 0 && (
              <p className="text-sm text-muted-foreground px-2">
                No labels yet
              </p>
            )}
          </div>

          <div className="border-t pt-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Create new label
            </p>
            <Input
              placeholder="Label name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              aria-label="New label name"
              maxLength={50}
            />
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label="Label color"
            >
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-5 w-5 rounded-full border-2 shrink-0"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      newColor === color ? "currentColor" : "transparent",
                  }}
                  onClick={() => setNewColor(color)}
                  aria-label={color}
                  aria-checked={newColor === color}
                  role="radio"
                />
              ))}
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              Create label
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
