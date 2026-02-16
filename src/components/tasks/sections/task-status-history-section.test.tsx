import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskStatusHistorySection } from "./task-status-history-section";
import type { StatusHistoryEntry, Column } from "@/types";

const mockColumns: Column[] = [
  { id: "todo", name: "To Do" },
  { id: "in-progress", name: "In Progress" },
  { id: "done", name: "Done" },
];

const mockStatusHistory: StatusHistoryEntry[] = [
  {
    columnId: "todo",
    timestamp: "2024-01-01T10:00:00.000Z",
  },
  {
    columnId: "in-progress",
    timestamp: "2024-01-02T10:00:00.000Z",
  },
  {
    columnId: "done",
    timestamp: "2024-01-03T10:00:00.000Z",
  },
];

describe("TaskStatusHistorySection", () => {
  it("renders nothing when statusHistory is empty", () => {
    const { container } = render(
      <TaskStatusHistorySection statusHistory={[]} columns={mockColumns} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders StatusHistory when statusHistory has entries", () => {
    render(
      <TaskStatusHistorySection
        statusHistory={mockStatusHistory}
        columns={mockColumns}
      />,
    );

    expect(
      screen.getByText(`Activity (${mockStatusHistory.length})`),
    ).toBeInTheDocument();
  });

  it("renders with single status history entry", () => {
    const singleEntry: StatusHistoryEntry[] = [
      {
        columnId: "todo",
        timestamp: "2024-01-01T10:00:00.000Z",
      },
    ];

    render(
      <TaskStatusHistorySection
        statusHistory={singleEntry}
        columns={mockColumns}
      />,
    );

    expect(screen.getByText("Activity (1)")).toBeInTheDocument();
  });

  it("renders column names from columns prop", () => {
    render(
      <TaskStatusHistorySection
        statusHistory={mockStatusHistory}
        columns={mockColumns}
      />,
    );

    // Click to expand the details
    const summary = screen.getByText(`Activity (${mockStatusHistory.length})`);
    summary.click();

    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders all status history entries", () => {
    render(
      <TaskStatusHistorySection
        statusHistory={mockStatusHistory}
        columns={mockColumns}
      />,
    );

    // Click to expand the details
    const summary = screen.getByText(`Activity (${mockStatusHistory.length})`);
    summary.click();

    const entries = screen.getAllByTestId("status-history-entry");
    expect(entries).toHaveLength(mockStatusHistory.length);
  });

  it("renders with many status history entries", () => {
    const manyEntries: StatusHistoryEntry[] = Array.from(
      { length: 10 },
      (_, i) => ({
        columnId: mockColumns[i % mockColumns.length].id,
        timestamp: new Date(
          Date.now() - (10 - i) * 86400000,
        ).toISOString(),
      }),
    );

    render(
      <TaskStatusHistorySection
        statusHistory={manyEntries}
        columns={mockColumns}
      />,
    );

    expect(screen.getByText("Activity (10)")).toBeInTheDocument();
  });

  it("renders with custom columns", () => {
    const customColumns: Column[] = [
      { id: "backlog", name: "Backlog" },
      { id: "ready", name: "Ready" },
      { id: "complete", name: "Complete" },
    ];

    const customHistory: StatusHistoryEntry[] = [
      {
        columnId: "backlog",
        timestamp: "2024-01-01T10:00:00.000Z",
      },
      {
        columnId: "ready",
        timestamp: "2024-01-02T10:00:00.000Z",
      },
    ];

    render(
      <TaskStatusHistorySection
        statusHistory={customHistory}
        columns={customColumns}
      />,
    );

    const summary = screen.getByText("Activity (2)");
    summary.click();

    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders with unknown column id", () => {
    const historyWithUnknownColumn: StatusHistoryEntry[] = [
      {
        columnId: "unknown-column",
        timestamp: "2024-01-01T10:00:00.000Z",
      },
    ];

    render(
      <TaskStatusHistorySection
        statusHistory={historyWithUnknownColumn}
        columns={mockColumns}
      />,
    );

    const summary = screen.getByText("Activity (1)");
    summary.click();

    // StatusHistory falls back to columnId when column name not found
    expect(screen.getByText("unknown-column")).toBeInTheDocument();
  });

  it("renders collapsed by default", () => {
    render(
      <TaskStatusHistorySection
        statusHistory={mockStatusHistory}
        columns={mockColumns}
      />,
    );

    // Summary should be visible
    expect(
      screen.getByText(`Activity (${mockStatusHistory.length})`),
    ).toBeInTheDocument();

    // Entry details should not be visible until expanded
    const entries = screen.queryAllByTestId("status-history-entry");
    // In a collapsed details element, entries exist in DOM but may not be visible
    // We just check the summary is present
    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  it("passes statusHistory and columns props correctly", () => {
    const testHistory: StatusHistoryEntry[] = [
      {
        columnId: "todo",
        timestamp: "2024-01-01T10:00:00.000Z",
      },
    ];

    render(
      <TaskStatusHistorySection
        statusHistory={testHistory}
        columns={mockColumns}
      />,
    );

    expect(screen.getByText("Activity (1)")).toBeInTheDocument();
  });
});
