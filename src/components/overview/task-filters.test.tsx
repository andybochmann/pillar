import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilters } from "./task-filters";
import type { Project, Column } from "@/types";

const mockProjects: Project[] = [
  {
    _id: "proj-1",
    name: "Project Alpha",
    description: "",
    categoryId: "cat-1",
    userId: "u1",
    columns: [
      { id: "todo", name: "To Do", order: 0 },
      { id: "in-progress", name: "In Progress", order: 1 },
      { id: "done", name: "Done", order: 2 },
    ],
    viewType: "board",
    archived: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "proj-2",
    name: "Project Beta",
    description: "",
    categoryId: "cat-1",
    userId: "u1",
    columns: [
      { id: "todo", name: "To Do", order: 0 },
      { id: "in-progress", name: "In Progress", order: 1 },
      { id: "done", name: "Done", order: 2 },
    ],
    viewType: "board",
    archived: false,
    createdAt: "",
    updatedAt: "",
  },
];

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

describe("TaskFilters", () => {
  beforeEach(() => {
    mockPush.mockClear();
    // Clear all params
    Array.from(mockSearchParams.keys()).forEach((key) => {
      mockSearchParams.delete(key);
    });
  });

  it("renders all filter controls", () => {
    render(<TaskFilters projects={mockProjects} />);

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(4);
    expect(screen.getByPlaceholderText("Filter by label...")).toBeInTheDocument();
  });

  it("does not show clear button when no filters active", () => {
    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("shows clear button with count (1) when project filter is active", () => {
    mockSearchParams.set("projectId", "proj-1");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (1)" }),
    ).toBeInTheDocument();
  });

  it("shows clear button with count (1) when priority filter is active", () => {
    mockSearchParams.set("priority", "high");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (1)" }),
    ).toBeInTheDocument();
  });

  it("shows clear button with count (1) when completed filter is active", () => {
    mockSearchParams.set("completed", "true");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (1)" }),
    ).toBeInTheDocument();
  });

  it("shows clear button with count (1) when labels filter is active", () => {
    mockSearchParams.set("labels", "bug");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (1)" }),
    ).toBeInTheDocument();
  });

  it("does not count projectId=all as active filter", () => {
    mockSearchParams.set("projectId", "all");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("does not count priority=all as active filter", () => {
    mockSearchParams.set("priority", "all");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("does not count completed=false as active filter", () => {
    mockSearchParams.set("completed", "false");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("does not count sortBy as active filter", () => {
    mockSearchParams.set("sortBy", "dueDate");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("shows clear button with count (2) when multiple filters active", () => {
    mockSearchParams.set("projectId", "proj-1");
    mockSearchParams.set("priority", "high");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (2)" }),
    ).toBeInTheDocument();
  });

  it("shows clear button with count (3) when three filters active", () => {
    mockSearchParams.set("projectId", "proj-1");
    mockSearchParams.set("priority", "high");
    mockSearchParams.set("completed", "true");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (3)" }),
    ).toBeInTheDocument();
  });

  it("shows clear button with count (4) when all filters active", () => {
    mockSearchParams.set("projectId", "proj-1");
    mockSearchParams.set("priority", "high");
    mockSearchParams.set("completed", "true");
    mockSearchParams.set("labels", "bug");

    render(<TaskFilters projects={mockProjects} />);

    expect(
      screen.getByRole("button", { name: "Clear filters (4)" }),
    ).toBeInTheDocument();
  });

  it("clears all filters when clear button clicked", async () => {
    const user = userEvent.setup();
    mockSearchParams.set("projectId", "proj-1");
    mockSearchParams.set("priority", "high");
    mockSearchParams.set("completed", "true");
    mockSearchParams.set("labels", "bug");

    render(<TaskFilters projects={mockProjects} />);

    await user.click(screen.getByRole("button", { name: "Clear filters (4)" }));

    expect(mockPush).toHaveBeenCalledWith("/overview");
  });

  it("correctly calculates count with mixed filter states", () => {
    mockSearchParams.set("projectId", "proj-1");
    mockSearchParams.set("priority", "all");
    mockSearchParams.set("completed", "false");
    mockSearchParams.set("sortBy", "dueDate");
    mockSearchParams.set("labels", "bug");

    render(<TaskFilters projects={mockProjects} />);

    // Only projectId and labels should count (priority=all, completed=false, sortBy is never counted)
    expect(
      screen.getByRole("button", { name: "Clear filters (2)" }),
    ).toBeInTheDocument();
  });

  it("shows count with all four filters active at once", () => {
    mockSearchParams.set("projectId", "proj-2");
    mockSearchParams.set("priority", "urgent");
    mockSearchParams.set("completed", "all");
    mockSearchParams.set("labels", "feature,bug");

    render(<TaskFilters projects={mockProjects} />);

    // projectId, priority, completed=all, and labels all count
    expect(
      screen.getByRole("button", { name: "Clear filters (4)" }),
    ).toBeInTheDocument();
  });

  it("correctly handles edge case with empty string labels param", () => {
    mockSearchParams.set("labels", "");

    render(<TaskFilters projects={mockProjects} />);

    // Empty string labels should not count as active filter
    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("sets label filter on Enter key", async () => {
    const user = userEvent.setup();
    render(<TaskFilters projects={mockProjects} />);

    const labelInput = screen.getByPlaceholderText("Filter by label...");
    await user.type(labelInput, "bug{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/overview?labels=bug");
  });

  it("removes label filter when Enter pressed with empty value", async () => {
    const user = userEvent.setup();
    mockSearchParams.set("labels", "bug");
    mockSearchParams.set("priority", "high");

    render(<TaskFilters projects={mockProjects} />);

    const labelInput = screen.getByPlaceholderText("Filter by label...");
    await user.clear(labelInput);
    await user.type(labelInput, "{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/overview?priority=high");
  });

  it("displays current projectId value", () => {
    mockSearchParams.set("projectId", "proj-1");

    render(<TaskFilters projects={mockProjects} />);

    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
  });

  it("displays current priority value", () => {
    mockSearchParams.set("priority", "high");

    render(<TaskFilters projects={mockProjects} />);

    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("displays current completed value", () => {
    mockSearchParams.set("completed", "true");

    render(<TaskFilters projects={mockProjects} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("displays current sortBy value", () => {
    mockSearchParams.set("sortBy", "dueDate");

    render(<TaskFilters projects={mockProjects} />);

    expect(screen.getByText("Due date")).toBeInTheDocument();
  });

  it("displays current labels value", () => {
    mockSearchParams.set("labels", "bug");

    render(<TaskFilters projects={mockProjects} />);

    const labelInput = screen.getByPlaceholderText("Filter by label...") as HTMLInputElement;
    expect(labelInput.defaultValue).toBe("bug");
  });
});
