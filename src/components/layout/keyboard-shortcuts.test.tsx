import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts";

vi.mock("@/components/ui/dialog", async () => {
  const actual = await vi.importActual("@/components/ui/dialog");
  return actual;
});

describe("KeyboardShortcutsDialog", () => {
  it("opens on '?' key press", async () => {
    render(<KeyboardShortcutsDialog />);

    fireEvent.keyDown(document, { key: "?" });

    await waitFor(() => {
      expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();
    });
  });

  it("does not open when typing in input", () => {
    render(
      <>
        <input data-testid="input" />
        <KeyboardShortcutsDialog />
      </>,
    );

    const input = screen.getByTestId("input");
    input.focus();
    fireEvent.keyDown(input, { key: "?" });

    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
  });

  it("renders Global shortcuts section", async () => {
    render(<KeyboardShortcutsDialog />);

    fireEvent.keyDown(document, { key: "?" });

    await waitFor(() => {
      expect(screen.getByText("Global")).toBeTruthy();
    });

    expect(screen.getByText("Open search")).toBeTruthy();
    expect(
      screen.getByText("Create new task (in current board)"),
    ).toBeTruthy();
    expect(screen.getByText("Show keyboard shortcuts")).toBeTruthy();
    expect(screen.getByText("Close dialog / sheet / search")).toBeTruthy();
    expect(screen.getByText("Create new project")).toBeTruthy();
  });

  it("renders Kanban Board shortcuts section", async () => {
    render(<KeyboardShortcutsDialog />);

    fireEvent.keyDown(document, { key: "?" });

    await waitFor(() => {
      expect(screen.getByText("Kanban Board")).toBeTruthy();
    });

    expect(screen.getByText("Move focus to next task")).toBeTruthy();
    expect(screen.getByText("Move focus to previous task")).toBeTruthy();
    expect(screen.getByText("Open focused task")).toBeTruthy();
    expect(screen.getByText("Open date picker")).toBeTruthy();
    expect(screen.getByText("Cycle priority")).toBeTruthy();
    expect(screen.getByText("Toggle complete")).toBeTruthy();
    expect(screen.getByText("Toggle selection")).toBeTruthy();
  });

  it("shows correct modifier key for new project shortcut", async () => {
    render(<KeyboardShortcutsDialog />);

    fireEvent.keyDown(document, { key: "?" });

    await waitFor(() => {
      expect(screen.getByText("Create new project")).toBeTruthy();
    });

    // Should display the shortcut key combo
    const shortcutKeys = screen.getAllByText(/Shift/);
    expect(shortcutKeys.length).toBeGreaterThan(0);
  });
});
