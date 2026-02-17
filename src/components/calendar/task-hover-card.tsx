"use client";

import * as React from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toLocalDate } from "@/lib/date-utils";
import type { Task, Label } from "@/types";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: {
    label: "Urgent",
    className: "bg-red-500 text-white",
  },
  high: {
    label: "High",
    className: "bg-orange-500 text-white",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-500 text-white",
  },
  low: {
    label: "Low",
    className: "bg-gray-400 text-white",
  },
};

interface TaskHoverCardProps {
  task: Task;
  labels?: Label[];
  children: React.ReactNode;
}

export function TaskHoverCard({
  task,
  labels = [],
  children,
}: TaskHoverCardProps) {
  const taskLabels = labels.filter((label) =>
    task.labels.includes(label._id),
  );

  return (
    <HoverCardPrimitive.Root data-slot="hover-card" openDelay={200}>
      <HoverCardPrimitive.Trigger asChild data-slot="hover-card-trigger">
        {children}
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          data-slot="hover-card-content"
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-80 origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          )}
        >
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Badge
                variant="secondary"
                className={cn("text-xs", priorityConfig[task.priority]?.className)}
              >
                {priorityConfig[task.priority]?.label || "Medium"}
              </Badge>

              {task.dueDate && (
                <span className="text-xs text-muted-foreground">
                  Due: {format(toLocalDate(task.dueDate), "MMM d, yyyy")}
                </span>
              )}
            </div>

            {taskLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {taskLabels.map((label) => (
                  <Badge
                    key={label._id}
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: label.color + "20",
                      color: label.color,
                      borderColor: label.color,
                    }}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
