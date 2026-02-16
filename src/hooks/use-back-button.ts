"use client";

import { useEffect, useRef } from "react";
import { pushOverlay, removeOverlay, cleanupOverlay } from "@/lib/overlay-stack";

export function useBackButton(
  id: string,
  open: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  const closedByPopRef = useRef(false);
  const wasOpenRef = useRef(false);

  // Update ref in effect to comply with React rules
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (open && !wasOpen) {
      // Opened: push onto overlay stack
      closedByPopRef.current = false;
      pushOverlay(id, () => {
        closedByPopRef.current = true;
        onCloseRef.current();
      });
    } else if (!open && wasOpen) {
      // Closed: if programmatic (not via popstate), remove from stack
      if (closedByPopRef.current) {
        closedByPopRef.current = false;
      } else {
        removeOverlay(id);
      }
    }
  }, [id, open]);

  // Cleanup on unmount while still open
  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        cleanupOverlay(id);
      }
    };
  }, [id]);
}
