import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskAssigneeSection } from "./task-assignee-section";
import type { ProjectMember } from "@/types";

const mockMembers: ProjectMember[] = [
  {
    _id: "member-1",
    projectId: "project-1",
    userId: "user-1",
    role: "owner",
    invitedBy: "user-1",
    userName: "Alice",
    userEmail: "alice@example.com",
    addedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    _id: "member-2",
    projectId: "project-1",
    userId: "user-2",
    role: "member",
    invitedBy: "user-1",
    userName: "Bob",
    userEmail: "bob@example.com",
    addedAt: "2024-01-02T00:00:00.000Z",
  },
  {
    _id: "member-3",
    projectId: "project-1",
    userId: "user-3",
    role: "member",
    invitedBy: "user-1",
    userEmail: "charlie@example.com",
    addedAt: "2024-01-03T00:00:00.000Z",
  },
];

describe("TaskAssigneeSection", () => {
  let onAssigneeChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAssigneeChange = vi.fn();
  });

  it("renders assignee label and select when members > 1", () => {
    render(
      <TaskAssigneeSection
        assigneeId={null}
        members={mockMembers}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });

  it("does not render when members is undefined", () => {
    const { container } = render(
      <TaskAssigneeSection
        assigneeId={null}
        members={undefined}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when members array is empty", () => {
    const { container } = render(
      <TaskAssigneeSection
        assigneeId={null}
        members={[]}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when only one member", () => {
    const { container } = render(
      <TaskAssigneeSection
        assigneeId={null}
        members={[mockMembers[0]]}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders when exactly two members", () => {
    render(
      <TaskAssigneeSection
        assigneeId={null}
        members={[mockMembers[0], mockMembers[1]]}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });

  it("renders with assigneeId as null (unassigned)", () => {
    render(
      <TaskAssigneeSection
        assigneeId={null}
        members={mockMembers}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });

  it("renders with assigneeId set to a user", () => {
    render(
      <TaskAssigneeSection
        assigneeId="user-2"
        members={mockMembers}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });

  // Note: Radix UI Select uses portals which don't render properly in jsdom,
  // so we verify the component renders correctly with different values.
  // Visual verification and interaction testing is done via E2E tests.

  it("renders with member that has userName", () => {
    render(
      <TaskAssigneeSection
        assigneeId="user-1"
        members={mockMembers}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });

  it("renders with member that has no userName (uses email)", () => {
    render(
      <TaskAssigneeSection
        assigneeId="user-3"
        members={mockMembers}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });

  it("renders with many members", () => {
    const manyMembers = Array.from({ length: 10 }, (_, i) => ({
      ...mockMembers[0],
      _id: `member-${i}`,
      userId: `user-${i}`,
      userName: `User ${i}`,
    }));

    render(
      <TaskAssigneeSection
        assigneeId={null}
        members={manyMembers}
        onAssigneeChange={onAssigneeChange}
      />,
    );

    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
  });
});
