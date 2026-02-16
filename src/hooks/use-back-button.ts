"use client";

import { useEffect, useRef } from "react";
import { pushOverlay, removeOverlay, cleanupOverlay } from "@/lib/overlay-stack";

/**
 * Integrates overlay components (Dialog, Sheet) with browser back button navigation.
 *
 * This hook manages a global overlay stack to enable native back button behavior for
 * modal components. When an overlay opens, it pushes a history entry; pressing the back
 * button closes the overlay instead of navigating away from the page. Supports multiple
 * stacked overlays (e.g., nested dialogs).
 *
 * @param {string} id - Unique identifier for this overlay instance (must be stable across renders)
 * @param {boolean} open - Current open state of the overlay
 * @param {() => void} onClose - Callback to invoke when overlay should close (via back button or programmatic close)
 *
 * @example
 * ```tsx
 * function TaskDialog({ taskId }: { taskId: string }) {
 *   const [open, setOpen] = useState(false);
 *
 *   // Enable back button to close dialog
 *   useBackButton(`task-dialog-${taskId}`, open, () => setOpen(false));
 *
 *   return (
 *     <Dialog open={open} onOpenChange={setOpen}>
 *       <DialogContent>
 *         <DialogTitle>Edit Task</DialogTitle>
 *         <TaskForm taskId={taskId} />
 *       </DialogContent>
 *     </Dialog>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Pushes history entry when overlay opens (via `pushOverlay`)
 * - Removes history entry when overlay closes programmatically (via `removeOverlay`)
 * - Cleans up history entry on unmount if overlay is still open
 * - Distinguishes between back-button close (popstate event) and programmatic close to avoid duplicate history mutations
 *
 * **Implementation Details:**
 * - Uses refs to track `onClose` and open state to avoid stale closures
 * - `closedByPopRef` tracks whether close was triggered by popstate to prevent removing history entry twice
 * - Global overlay stack in `@/lib/overlay-stack` manages history API interactions
 */
export function useBackButton(
  id: string,
  open: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closedByPopRef = useRef(false);
  const wasOpenRef = useRef(false);

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
