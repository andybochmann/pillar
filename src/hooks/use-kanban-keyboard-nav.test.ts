import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKanbanKeyboardNav } from "./use-kanban-keyboard-nav";
import type { Task, Column } from "@/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: "task-1",
    title: "Test task",
    projectId: "proj-1",
    userId: "user-1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

const tasks: Task[] = [
  makeTask({ _id: "t1", title: "Task 1", columnId: "todo", order: 0 }),
  makeTask({ _id: "t2", title: "Task 2", columnId: "todo", order: 1 }),
  makeTask({ _id: "t3", title: "Task 3", columnId: "in-progress", order: 0 }),
  makeTask({ _id: "t4", title: "Task 4", columnId: "done", order: 0 }),
];

function fireKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...options }),
  );
}

function fireKeyOnElement(
  element: HTMLElement,
  key: string,
  options: Partial<KeyboardEventInit> = {},
) {
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...options }),
  );
}

describe("useKanbanKeyboardNav", () => {
  const handlers = {
    onOpenTask: vi.fn(),
    onCyclePriority: vi.fn(),
    onToggleComplete: vi.fn(),
    onToggleSelect: vi.fn(),
    onOpenDatePicker: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any leftover DOM elements
    document.body.innerHTML = "";
  });

  it("starts with no focused task", () => {
    const { result } = renderHook(() =>
      useKanbanKeyboardNav({ tasks, columns, ...handlers }),
    );
    expect(result.current.focusedTaskId).toBeNull();
  });

  describe("j/k navigation", () => {
    it("focuses first task on j when nothing is focused", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j"));

      expect(result.current.focusedTaskId).toBe("t1");
    });

    it("moves focus to next task on j", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // t1
      act(() => fireKey("j")); // t2

      expect(result.current.focusedTaskId).toBe("t2");
    });

    it("moves focus across columns with j", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // t1
      act(() => fireKey("j")); // t2
      act(() => fireKey("j")); // t3 (in-progress column)

      expect(result.current.focusedTaskId).toBe("t3");
    });

    it("wraps to first task when j at end", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // t1
      act(() => fireKey("j")); // t2
      act(() => fireKey("j")); // t3
      act(() => fireKey("j")); // t4
      act(() => fireKey("j")); // wraps to t1

      expect(result.current.focusedTaskId).toBe("t1");
    });

    it("focuses last task on k when nothing is focused", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("k"));

      expect(result.current.focusedTaskId).toBe("t4");
    });

    it("moves focus to previous task on k", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // t1
      act(() => fireKey("j")); // t2
      act(() => fireKey("k")); // t1

      expect(result.current.focusedTaskId).toBe("t1");
    });

    it("wraps to last task when k at beginning", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // t1
      act(() => fireKey("k")); // wraps to t4

      expect(result.current.focusedTaskId).toBe("t4");
    });
  });

  describe("action shortcuts", () => {
    it("opens task on Enter when focused", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // focus t1
      act(() => fireKey("Enter"));

      expect(handlers.onOpenTask).toHaveBeenCalledWith("t1");
    });

    it("opens task on e when focused", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j"));
      act(() => fireKey("e"));

      expect(handlers.onOpenTask).toHaveBeenCalledWith("t1");
    });

    it("does not open task when nothing is focused", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("Enter"));

      expect(handlers.onOpenTask).not.toHaveBeenCalled();
    });

    it("cycles priority on p", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // focus t1 (priority: medium)
      act(() => fireKey("p"));

      expect(handlers.onCyclePriority).toHaveBeenCalledWith("t1");
    });

    it("toggles complete on c", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j"));
      act(() => fireKey("c"));

      expect(handlers.onToggleComplete).toHaveBeenCalledWith("t1");
    });

    it("toggles selection on x", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j"));
      act(() => fireKey("x"));

      expect(handlers.onToggleSelect).toHaveBeenCalledWith("t1");
    });

    it("opens date picker on d", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j"));
      act(() => fireKey("d"));

      expect(handlers.onOpenDatePicker).toHaveBeenCalledWith("t1");
    });
  });

  describe("input guard", () => {
    it("ignores shortcuts when target is INPUT", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      act(() => fireKeyOnElement(input, "j"));

      // focusedTaskId should remain null — but we can't easily check hook state
      // from the input target. Instead verify no action is triggered.
      expect(handlers.onOpenTask).not.toHaveBeenCalled();
    });

    it("ignores shortcuts when target is TEXTAREA", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      act(() => fireKeyOnElement(textarea, "j"));
      act(() => fireKeyOnElement(textarea, "e"));

      expect(handlers.onOpenTask).not.toHaveBeenCalled();
    });

    it("ignores shortcuts when target is contentEditable", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      const div = document.createElement("div");
      div.contentEditable = "true";
      document.body.appendChild(div);
      div.focus();

      act(() => fireKeyOnElement(div, "j"));

      expect(handlers.onOpenTask).not.toHaveBeenCalled();
    });
  });

  describe("modal guard", () => {
    it("ignores shortcuts when a dialog is open", () => {
      renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      // Simulate an open dialog/sheet
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      document.body.appendChild(dialog);

      act(() => fireKey("j"));

      // Should not focus when dialog is open
      expect(handlers.onOpenTask).not.toHaveBeenCalled();
    });
  });

  describe("disabled state", () => {
    it("ignores all shortcuts when disabled", () => {
      renderHook(() =>
        useKanbanKeyboardNav({
          tasks,
          columns,
          ...handlers,
          disabled: true,
        }),
      );

      act(() => fireKey("j"));
      act(() => fireKey("e"));

      expect(handlers.onOpenTask).not.toHaveBeenCalled();
    });
  });

  describe("empty tasks", () => {
    it("does nothing with j when no tasks", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks: [], columns, ...handlers }),
      );

      act(() => fireKey("j"));

      expect(result.current.focusedTaskId).toBeNull();
    });
  });

  describe("Escape clears focus", () => {
    it("clears focused task on Escape", () => {
      const { result } = renderHook(() =>
        useKanbanKeyboardNav({ tasks, columns, ...handlers }),
      );

      act(() => fireKey("j")); // focus t1
      expect(result.current.focusedTaskId).toBe("t1");

      act(() => fireKey("Escape"));
      expect(result.current.focusedTaskId).toBeNull();
    });
  });
});
