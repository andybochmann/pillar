"use client";

import { useEffect, useState, useCallback } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import type { FilterPreset, FilterPresetContext } from "@/types";

interface FilterPresetSelectorProps {
  context: FilterPresetContext;
  currentFilters: Record<string, string | string[]>;
  onApply: (filters: Record<string, string | string[]>) => void;
}

export function FilterPresetSelector({
  context,
  currentFilters,
  onApply,
}: FilterPresetSelectorProps) {
  const { presets, fetchPresets, createPreset, deletePreset } =
    useFilterPresets(context);
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const handleApply = useCallback(
    (preset: FilterPreset) => {
      onApply(preset.filters);
      setOpen(false);
    },
    [onApply],
  );

  const handleSave = useCallback(async () => {
    const name = presetName.trim();
    if (!name) return;
    try {
      setSaving(true);
      await createPreset(name, currentFilters);
      toast.success("Filter preset saved");
      setSaveDialogOpen(false);
      setPresetName("");
    } catch {
      toast.error("Failed to save preset");
    } finally {
      setSaving(false);
    }
  }, [presetName, currentFilters, createPreset]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deletePreset(id);
        toast.success("Preset deleted");
        setDeleteConfirmId(null);
      } catch {
        toast.error("Failed to delete preset");
      }
    },
    [deletePreset],
  );

  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" data-testid="preset-selector-trigger">
            <Bookmark className="mr-1 h-4 w-4" />
            Presets
            {presets.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({presets.length})
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          {presets.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              No saved presets
            </p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset._id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
                >
                  <button
                    className="flex-1 text-left text-sm"
                    onClick={() => handleApply(preset)}
                    data-testid={`preset-${preset._id}`}
                  >
                    {preset.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(preset._id);
                    }}
                    data-testid={`delete-preset-${preset._id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start"
              onClick={() => {
                setOpen(false);
                setSaveDialogOpen(true);
              }}
              data-testid="save-preset-button"
            >
              <Plus className="mr-1 h-4 w-4" />
              Save current filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter preset</DialogTitle>
            <DialogDescription>
              Give this filter combination a name to quickly apply it later.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            data-testid="preset-name-input"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!presetName.trim() || saving}
              data-testid="confirm-save-preset"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(v) => !v && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete preset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this filter preset? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              data-testid="confirm-delete-preset"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
