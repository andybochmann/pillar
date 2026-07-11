import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskBlockedBySection } from "./task-blocked-by-section";
import type { Task } from "@/types";

function makeTask(overrides: Partial<Task> & { _id: string; title: string }): Task {
  return {
    projectId: "proj-1",
    userId: "user-1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    blockedBy: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Task;
}

const tasks: Task[] = [
  makeTask({ _id: "t1", title: "Task One" }),
  makeTask({ _id: "t2", title: "Task Two", completedAt: "2026-01-02T00:00:00Z" }),
  makeTask({ _id: "t3", title: "Task Three" }),
];

describe("TaskBlockedBySection", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("renders the section label", () => {
    render(
      <TaskBlockedBySection
        taskId="t1"
        blockedBy={[]}
        allTasks={tasks}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Blocked by")).toBeInTheDocument();
  });

  it("shows an empty state when there are no blockers", () => {
    render(
      <TaskBlockedBySection
        taskId="t1"
        blockedBy={[]}
        allTasks={tasks}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Not blocked by any tasks.")).toBeInTheDocument();
  });

  it("lists current blockers with their title and open/done status", () => {
    render(
      <TaskBlockedBySection
        taskId="t1"
        blockedBy={["t2", "t3"]}
        allTasks={tasks}
        onChange={onChange}
      />,
    );
    // t2 is completed → Done, t3 is open → Open
    const done = screen.getByText("Task Two").closest("li")!;
    expect(within(done).getByText("Done")).toBeInTheDocument();
    const open = screen.getByText("Task Three").closest("li")!;
    expect(within(open).getByText("Open")).toBeInTheDocument();
  });

  it("removes a blocker via its remove button", async () => {
    const user = userEvent.setup();
    render(
      <TaskBlockedBySection
        taskId="t1"
        blockedBy={["t2", "t3"]}
        allTasks={tasks}
        onChange={onChange}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Remove blocker Task Two" }),
    );
    expect(onChange).toHaveBeenCalledWith(["t3"]);
  });

  it("renders an unknown-task placeholder for blockers missing from allTasks", () => {
    render(
      <TaskBlockedBySection
        taskId="t1"
        blockedBy={["missing"]}
        allTasks={tasks}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Unknown task")).toBeInTheDocument();
  });

  it("offers an Add blocker control", () => {
    render(
      <TaskBlockedBySection
        taskId="t1"
        blockedBy={[]}
        allTasks={tasks}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Add blocker" }),
    ).toBeInTheDocument();
  });
});
