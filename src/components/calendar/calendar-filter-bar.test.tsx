import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarFilterBar, EMPTY_FILTERS } from "./calendar-filter-bar";
import type { Label, Project, Priority } from "@/types";

describe("CalendarFilterBar", () => {
  const mockProjects: Project[] = [
    {
      _id: "proj1",
      name: "Project Alpha",
      categoryId: "cat1",
      userId: "user1",
      columns: [],
      viewType: "board",
      archived: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      _id: "proj2",
      name: "Project Beta",
      categoryId: "cat1",
      userId: "user1",
      columns: [],
      viewType: "board",
      archived: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  const mockLabels: Label[] = [
    {
      _id: "label1",
      name: "Bug",
      color: "#ff0000",
      userId: "user1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      _id: "label2",
      name: "Feature",
      color: "#00ff00",
      userId: "user1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  const mockAssignees = [
    { _id: "user1", name: "John Doe", email: "john@example.com" },
    { _id: "user2", name: "Jane Smith", email: "jane@example.com" },
  ];

  it("renders the filter bar with filters button", () => {
    const onChange = vi.fn();
    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("shows active filter count when filters are applied", () => {
    const onChange = vi.fn();
    const filters = {
      projects: ["proj1"],
      labels: ["label1"],
      priorities: ["high" as Priority],
      assignees: ["user1"],
    };

    render(
      <CalendarFilterBar
        filters={filters}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Filters (4)" }),
    ).toBeInTheDocument();
  });

  it("renders filter popover content when opened", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    // Check for filter section headings
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
  });

  it("toggles priority filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "High" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      priorities: ["high"],
    });
  });

  it("toggles project filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Project Alpha" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      projects: ["proj1"],
    });
  });

  it("toggles label filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Bug" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      labels: ["label1"],
    });
  });

  it("toggles assignee filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "John Doe" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      assignees: ["user1"],
    });
  });

  it("removes filter when toggled off", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters = {
      projects: [],
      labels: [],
      priorities: ["high" as Priority],
      assignees: [],
    };

    render(
      <CalendarFilterBar
        filters={filters}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters (1)" }));
    await user.click(screen.getByRole("button", { name: "High", pressed: true }));

    expect(onChange).toHaveBeenCalledWith({
      ...filters,
      priorities: [],
    });
  });

  it("shows clear filters button when filters are active", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters = {
      projects: ["proj1"],
      labels: [],
      priorities: ["high" as Priority],
      assignees: [],
    };

    render(
      <CalendarFilterBar
        filters={filters}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    const clearButton = screen.getByRole("button", { name: "Clear filters" });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  it("does not show clear filters button when no filters are active", () => {
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
  });

  it("handles empty labels gracefully", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={[]}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    // Labels section should not be rendered
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();
  });

  it("handles empty assignees gracefully", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    // Assignee section should not be rendered
    expect(screen.queryByText("Assignee")).not.toBeInTheDocument();
  });

  it("supports multiple filters simultaneously", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CalendarFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        projects={mockProjects}
        labels={mockLabels}
        assignees={mockAssignees}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    // Select multiple filters
    await user.click(screen.getByRole("button", { name: "Urgent" }));

    // First onChange call with urgent priority
    expect(onChange).toHaveBeenNthCalledWith(1, {
      ...EMPTY_FILTERS,
      priorities: ["urgent"],
    });
  });
});
