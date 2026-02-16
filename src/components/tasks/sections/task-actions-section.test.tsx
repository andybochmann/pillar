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
    expect(
      screen.queryByRole("button", { name: /reopen/i }),
    ).not.toBeInTheDocument();
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

  it("renders Delete button", () => {
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
      screen.getByRole("button", { name: /delete/i }),
    ).toBeInTheDocument();
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

  it("opens confirm dialog when Delete button is clicked", async () => {
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

    await user.click(screen.getByRole("button", { name: /delete$/i }));

    expect(screen.getByText("Delete task?")).toBeInTheDocument();
    expect(
      screen.getByText('"Test Task" will be permanently deleted.'),
    ).toBeInTheDocument();
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

    // Open dialog
    await user.click(screen.getByRole("button", { name: /delete$/i }));
    expect(screen.getByText("Delete task?")).toBeInTheDocument();

    // Cancel
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Delete task?")).not.toBeInTheDocument();
    });

    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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

    // Open dialog
    await user.click(screen.getByRole("button", { name: /delete$/i }));

    // Confirm - use getAllByRole and find the one in the dialog
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = deleteButtons.find(
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

    // Open dialog
    await user.click(screen.getByRole("button", { name: /delete$/i }));

    // Confirm
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = deleteButtons.find(
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

    // Open dialog
    await user.click(screen.getByRole("button", { name: /delete$/i }));

    // Confirm
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = deleteButtons.find(
      (btn) => btn.textContent === "Delete",
    );
    await user.click(confirmButton!);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to delete task");
    });
  });

  it("applies correct CSS classes to action buttons", () => {
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

    const markCompleteButton = screen.getByRole("button", {
      name: /mark complete/i,
    });
    expect(markCompleteButton).toHaveClass("w-full");

    const deleteButton = screen.getByRole("button", { name: /delete$/i });
    expect(deleteButton).toHaveClass("w-full");
  });

  it("applies correct styling to container", () => {
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

    const actionsContainer = container.querySelector(".mt-auto.space-y-2.pt-6");
    expect(actionsContainer).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /delete$/i }));

    expect(
      screen.getByText(
        '"Task with \'quotes\' & special <chars>" will be permanently deleted.',
      ),
    ).toBeInTheDocument();
  });

  it("closes dialog after successful deletion", async () => {
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

    // Open dialog
    await user.click(screen.getByRole("button", { name: /delete$/i }));
    expect(screen.getByText("Delete task?")).toBeInTheDocument();

    // Confirm
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = deleteButtons.find(
      (btn) => btn.textContent === "Delete",
    );
    await user.click(confirmButton!);

    // Dialog should close after successful deletion
    await waitFor(() => {
      expect(screen.queryByText("Delete task?")).not.toBeInTheDocument();
    });
  });

  it("shows error toast and does not call onClose when deletion fails", async () => {
    const user = userEvent.setup();
    onDelete.mockRejectedValue(new Error("Delete failed"));

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

    // Open dialog
    await user.click(screen.getByRole("button", { name: /delete$/i }));

    // Confirm
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = deleteButtons.find(
      (btn) => btn.textContent === "Delete",
    );
    await user.click(confirmButton!);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });

    // onClose should not be called when deletion fails
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("Web Share", () => {
    it("renders Share button when Web Share API is available", () => {
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

      expect(
        screen.getByRole("button", { name: /share/i }),
      ).toBeInTheDocument();
    });

    it("does not render Share button when Web Share API is unavailable", () => {
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

      expect(
        screen.queryByRole("button", { name: /share/i }),
      ).not.toBeInTheDocument();
    });

    it("calls shareTask when Share button is clicked", async () => {
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

      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(shareTask).toHaveBeenCalledWith({
        title: "My Task",
        description: "Task description",
        priority: "high",
        dueDate: "2026-03-01T00:00:00.000Z",
      });
    });
  });
});
