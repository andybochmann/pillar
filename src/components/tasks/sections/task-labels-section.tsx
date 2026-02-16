"use client";

import { Label } from "@/components/ui/label";
import { LabelPicker } from "@/components/tasks/label-picker";
import type { Label as LabelType } from "@/types";

interface TaskLabelsSectionProps {
  allLabels?: LabelType[];
  selectedLabels: string[];
  onToggleLabel: (labelId: string) => void;
  onCreateLabel?: (data: { name: string; color: string }) => Promise<void>;
}

export function TaskLabelsSection({
  allLabels,
  selectedLabels,
  onToggleLabel,
  onCreateLabel,
}: TaskLabelsSectionProps) {
  async function handleCreateLabel(data: { name: string; color: string }) {
    if (onCreateLabel) {
      await onCreateLabel(data);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>Labels</Label>
      <LabelPicker
        labels={allLabels ?? []}
        selectedLabels={selectedLabels}
        onToggle={onToggleLabel}
        onCreate={handleCreateLabel}
      />
    </div>
  );
}
