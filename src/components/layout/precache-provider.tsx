"use client";

import { usePrecache } from "@/hooks/use-precache";

export function PrecacheProvider() {
  usePrecache();
  return null;
}
