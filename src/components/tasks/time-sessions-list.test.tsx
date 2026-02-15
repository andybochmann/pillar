import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeSessionsList } from "./time-sessions-list";
import type { TimeSession } from "@/types";

describe("TimeSessionsList", () => {
  const completedSession: TimeSession = {
    _id: "s1",
    startedAt: "2026-02-14T09:00:00Z",
    endedAt: "2026-02-14T10:30:00Z",
    userId: "user-1",
  };

  const activeSession: TimeSession = {
    _id: "s2",
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    endedAt: null,
    userId: "user-1",
  };

  async function expandList() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /time tracking/i }));
  }

  it("displays total tracked time", () => {
    render(
      <TimeSessionsList
        sessions={[completedSession]}
        onDeleteSession={vi.fn()}
      />,
    );
    expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
  });

  it("shows 'No time tracked' when empty", () => {
    render(
      <TimeSessionsList sessions={[]} onDeleteSession={vi.fn()} />,
    );
    expect(screen.getByText(/no time tracked/i)).toBeInTheDocument();
  });

  it("displays session date and time range when expanded", async () => {
    render(
      <TimeSessionsList
        sessions={[completedSession]}
        onDeleteSession={vi.fn()}
      />,
    );
    await expandList();
    expect(screen.getByText(/feb 14/i)).toBeInTheDocument();
  });

  it("shows 'In progress' for active session when expanded", async () => {
    render(
      <TimeSessionsList
        sessions={[activeSession]}
        onDeleteSession={vi.fn()}
      />,
    );
    await expandList();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it("calls onDeleteSession when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TimeSessionsList
        sessions={[completedSession]}
        onDeleteSession={onDelete}
      />,
    );

    await expandList();
    await user.click(screen.getByRole("button", { name: /delete session/i }));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("sorts sessions newest first", async () => {
    const olderSession: TimeSession = {
      _id: "s0",
      startedAt: "2026-02-13T09:00:00Z",
      endedAt: "2026-02-13T10:00:00Z",
      userId: "user-1",
    };

    render(
      <TimeSessionsList
        sessions={[olderSession, completedSession]}
        onDeleteSession={vi.fn()}
      />,
    );

    await expandList();

    const dates = screen.getAllByTestId("session-date");
    // Newer (Feb 14) should come first
    expect(dates[0].textContent).toMatch(/feb 14/i);
    expect(dates[1].textContent).toMatch(/feb 13/i);
  });
});
