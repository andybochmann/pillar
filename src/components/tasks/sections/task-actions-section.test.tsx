import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskActionsSection } from "./task-actions-section";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/share-task", () => ({
  canShareTasks: vi.fn(() => true),
  shareTask: vi.fn().mockResolvedValue(true),
}));

import { toast } from "sonner";
import { canShareTasks, shareTask } from "@/lib/share-task";

describe("TaskActionsSection", () => {
  let onUpdate: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn().mockResolvedValue(undefined);
    onDelete = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
    vi.clearAllMocks();
    vi.mocked(canShareTasks).mockReturnValue(true);
    vi.mocked(shareTask).mockResolvedValue(true);
  });

  it("renders Mark Complete button when task is not completed", () => {
    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt={null}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("button", { name: /mark complete/i }),
    ).toBeInTheDocument();
  });

  it("renders Reopen button when task is completed", () => {
    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt="2024-01-15T10:00:00Z"
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("button", { name: /reopen/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark complete/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onUpdate with completedAt when Mark Complete is clicked", async () => {
    const user = userEvent.setup();
    const mockDate = new Date("2024-02-15T12:00:00Z");
    vi.setSystemTime(mockDate);

    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt={null}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        completedAt: "2024-02-15T12:00:00.000Z",
      });
    });

    vi.useRealTimers();
  });

  it("calls onUpdate with null completedAt when Reopen is clicked", async () => {
    const user = userEvent.setup();

    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt="2024-01-15T10:00:00Z"
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /reopen/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({ completedAt: null });
    });
  });

  it("shows error toast when onUpdate fails", async () => {
    const user = userEvent.setup();
    const error = new Error("Update failed");
    onUpdate.mockRejectedValue(error);

    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt={null}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  it("shows generic error toast when onUpdate fails with non-Error", async () => {
    const user = userEvent.setup();
    onUpdate.mockRejectedValue("string error");

    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt={null}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update task");
    });
  });

  describe("overflow menu", () => {
    it("renders more actions button", () => {
      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      expect(
        screen.getByRole("button", { name: /more actions/i }),
      ).toBeInTheDocument();
    });

    it("shows Delete in overflow menu", async () => {
      const user = userEvent.setup();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.getByRole("menuitem", { name: /delete/i }),
      ).toBeInTheDocument();
    });

    it("opens confirm dialog when Delete menu item is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      expect(screen.getByText("Delete task?")).toBeInTheDocument();
      expect(
        screen.getByText('"Test Task" will be permanently deleted.'),
      ).toBeInTheDocument();
    });

    it("calls onDelete and onClose when delete is confirmed", async () => {
      const user = userEvent.setup();

      render(
        <TaskActionsSection
          taskId="task-123"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      // Open menu and click Delete
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      // Confirm in dialog
      const confirmButton = screen.getAllByRole("button", { name: /delete/i }).find(
        (btn) => btn.textContent === "Delete",
      );
      expect(confirmButton).toBeDefined();
      await user.click(confirmButton!);

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith("task-123");
        expect(onDelete).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Task deleted");
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("shows error toast when onDelete fails", async () => {
      const user = userEvent.setup();
      const error = new Error("Delete failed");
      onDelete.mockRejectedValue(error);

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      const confirmButton = screen.getAllByRole("button", { name: /delete/i }).find(
        (btn) => btn.textContent === "Delete",
      );
      await user.click(confirmButton!);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Delete failed");
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows generic error toast when onDelete fails with non-Error", async () => {
      const user = userEvent.setup();
      onDelete.mockRejectedValue("string error");

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      const confirmButton = screen.getAllByRole("button", { name: /delete/i }).find(
        (btn) => btn.textContent === "Delete",
      );
      await user.click(confirmButton!);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete task");
      });
    });

    it("closes confirm dialog when cancelled", async () => {
      const user = userEvent.setup();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));
      expect(screen.getByText("Delete task?")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText("Delete task?")).not.toBeInTheDocument();
      });

      expect(onDelete).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows Archive when task is completed and onArchive provided", async () => {
      const user = userEvent.setup();
      const onArchive = vi.fn();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt="2024-01-15T10:00:00Z"
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
          onArchive={onArchive}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.getByRole("menuitem", { name: /archive/i }),
      ).toBeInTheDocument();
    });

    it("does not show Archive when task is not completed", async () => {
      const user = userEvent.setup();
      const onArchive = vi.fn();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
          onArchive={onArchive}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.queryByRole("menuitem", { name: /archive/i }),
      ).not.toBeInTheDocument();
    });

    it("calls onArchive when Archive menu item is clicked", async () => {
      const user = userEvent.setup();
      const onArchive = vi.fn();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt="2024-01-15T10:00:00Z"
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
          onArchive={onArchive}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /archive/i }));

      expect(onArchive).toHaveBeenCalled();
    });

    it("shows Duplicate when onDuplicate provided", async () => {
      const user = userEvent.setup();
      const onDuplicate = vi.fn();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
          onDuplicate={onDuplicate}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.getByRole("menuitem", { name: /duplicate/i }),
      ).toBeInTheDocument();
    });

    it("does not show Duplicate when onDuplicate not provided", async () => {
      const user = userEvent.setup();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.queryByRole("menuitem", { name: /duplicate/i }),
      ).not.toBeInTheDocument();
    });

    it("calls onDuplicate when Duplicate menu item is clicked", async () => {
      const user = userEvent.setup();
      const onDuplicate = vi.fn();

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
          onDuplicate={onDuplicate}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      expect(onDuplicate).toHaveBeenCalled();
    });
  });

  describe("Web Share", () => {
    it("shows Share in overflow menu when Web Share API is available", async () => {
      const user = userEvent.setup();
      vi.mocked(canShareTasks).mockReturnValue(true);

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.getByRole("menuitem", { name: /share/i }),
      ).toBeInTheDocument();
    });

    it("does not show Share in overflow menu when Web Share API is unavailable", async () => {
      const user = userEvent.setup();
      vi.mocked(canShareTasks).mockReturnValue(false);

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="Test Task"
          taskPriority="medium"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));

      expect(
        screen.queryByRole("menuitem", { name: /share/i }),
      ).not.toBeInTheDocument();
    });

    it("calls shareTask when Share menu item is clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(canShareTasks).mockReturnValue(true);

      render(
        <TaskActionsSection
          taskId="task-1"
          taskTitle="My Task"
          taskDescription="Task description"
          taskPriority="high"
          taskDueDate="2026-03-01T00:00:00.000Z"
          completedAt={null}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /share/i }));

      expect(shareTask).toHaveBeenCalledWith({
        title: "My Task",
        description: "Task description",
        priority: "high",
        dueDate: "2026-03-01T00:00:00.000Z",
      });
    });
  });

  it("renders with escaped task title in confirm dialog", async () => {
    const user = userEvent.setup();

    render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Task with 'quotes' & special <chars>"
        taskPriority="medium"
        completedAt={null}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(
      screen.getByText(
        '"Task with \'quotes\' & special <chars>" will be permanently deleted.',
      ),
    ).toBeInTheDocument();
  });

  it("has sticky footer styling with border-t", () => {
    const { container } = render(
      <TaskActionsSection
        taskId="task-1"
        taskTitle="Test Task"
        taskPriority="medium"
        completedAt={null}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    const footer = container.querySelector(".border-t.bg-background");
    expect(footer).toBeInTheDocument();
  });
});
