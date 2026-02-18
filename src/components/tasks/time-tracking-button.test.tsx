import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeTrackingButton } from "./time-tracking-button";

describe("TimeTrackingButton", () => {
  const defaultProps = {
    taskId: "task-1",
    isActive: false,
    isOtherUserActive: false,
    onStart: vi.fn(),
    onStop: vi.fn(),
  };

  it("renders play button when idle", () => {
    render(<TimeTrackingButton {...defaultProps} />);
    expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
  });

  it("calls onStart when play is clicked", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<TimeTrackingButton {...defaultProps} onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: /start tracking/i }));
    expect(onStart).toHaveBeenCalledWith("task-1");
  });

  it("renders stop button when active", () => {
    render(<TimeTrackingButton {...defaultProps} isActive />);
    expect(screen.getByRole("button", { name: /stop tracking/i })).toBeInTheDocument();
  });

  it("calls onStop when stop is clicked", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<TimeTrackingButton {...defaultProps} isActive onStop={onStop} />);

    await user.click(screen.getByRole("button", { name: /stop tracking/i }));
    expect(onStop).toHaveBeenCalledWith("task-1");
  });

  it("shows elapsed time when active", () => {
    render(
      <TimeTrackingButton
        {...defaultProps}
        isActive
        activeStartedAt="2026-02-14T09:00:00Z"
      />,
    );
    // Should display some time indicator
    expect(screen.getByRole("button", { name: /stop tracking/i })).toBeInTheDocument();
  });

  it("shows indicator for other user active", () => {
    render(<TimeTrackingButton {...defaultProps} isOtherUserActive />);
    expect(screen.getByTitle(/another user is tracking/i)).toBeInTheDocument();
  });

  it("stops event propagation on click", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <TimeTrackingButton {...defaultProps} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /start tracking/i }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("shows total tracked time when idle with historical sessions", () => {
    render(
      <TimeTrackingButton
        {...defaultProps}
        totalTrackedMs={5400000}
      />,
    );
    expect(screen.getByText(/1h 30m 0s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
  });

  it("does not show time badge when totalTrackedMs is zero", () => {
    render(<TimeTrackingButton {...defaultProps} totalTrackedMs={0} />);
    expect(screen.queryByText(/h.*m.*s/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
  });
});
