"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectMember } from "@/types";

interface TaskAssigneeSectionProps {
  assigneeId: string | null;
  members?: ProjectMember[];
  onAssigneeChange: (assigneeId: string | null) => void;
}

export function TaskAssigneeSection({
  assigneeId,
  members,
  onAssigneeChange,
}: TaskAssigneeSectionProps) {
  // Only render if members exist and there's more than one
  if (!members || members.length <= 1) {
    return null;
  }

  function handleValueChange(value: string) {
    const newValue = value === "unassigned" ? null : value;
    onAssigneeChange(newValue);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="task-assignee">Assignee</Label>
      <Select
        value={assigneeId ?? "unassigned"}
        onValueChange={handleValueChange}
      >
        <SelectTrigger id="task-assignee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.userName ?? member.userEmail}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
