import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusHistory } from "./status-history";
import type { StatusHistoryEntry, Column } from "@/types";

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

describe("StatusHistory", () => {
  it("renders nothing when history is empty", () => {
    const { container } = render(
      <StatusHistory statusHistory={[]} columns={columns} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders timeline entries with column names", () => {
    const history: StatusHistoryEntry[] = [
      { columnId: "todo", timestamp: new Date("2026-02-10T10:00:00Z").toISOString() },
      { columnId: "in-progress", timestamp: new Date("2026-02-12T14:00:00Z").toISOString() },
    ];

    render(<StatusHistory statusHistory={history} columns={columns} />);

    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("shows entries in reverse chronological order (most recent first)", () => {
    const history: StatusHistoryEntry[] = [
      { columnId: "todo", timestamp: new Date("2026-02-10T10:00:00Z").toISOString() },
      { columnId: "in-progress", timestamp: new Date("2026-02-12T14:00:00Z").toISOString() },
      { columnId: "done", timestamp: new Date("2026-02-14T09:00:00Z").toISOString() },
    ];

    render(<StatusHistory statusHistory={history} columns={columns} />);

    const entries = screen.getAllByTestId("status-history-entry");
    expect(entries).toHaveLength(3);
    expect(entries[0]).toHaveTextContent("Done");
    expect(entries[1]).toHaveTextContent("In Progress");
    expect(entries[2]).toHaveTextContent("To Do");
  });

  it("shows column ID when column name is not found", () => {
    const history: StatusHistoryEntry[] = [
      { columnId: "unknown-col", timestamp: new Date().toISOString() },
    ];

    render(<StatusHistory statusHistory={history} columns={columns} />);

    expect(screen.getByText("unknown-col")).toBeInTheDocument();
  });

  it("displays relative timestamps", () => {
    const history: StatusHistoryEntry[] = [
      { columnId: "todo", timestamp: new Date().toISOString() },
    ];

    render(<StatusHistory statusHistory={history} columns={columns} />);

    // "less than a minute ago" or similar from formatDistanceToNow
    expect(screen.getByText(/ago|less than/i)).toBeInTheDocument();
  });
});
