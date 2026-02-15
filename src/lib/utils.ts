import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Columns3, ListChecks } from "lucide-react";
import type { ViewType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getViewIcon(viewType: ViewType) {
  return viewType === "list" ? ListChecks : Columns3;
}
