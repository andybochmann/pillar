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

  it("lists all shortcuts", async () => {
    render(<KeyboardShortcutsDialog />);

    fireEvent.keyDown(document, { key: "?" });

    await waitFor(() => {
      expect(screen.getByText("Open search")).toBeTruthy();
      expect(screen.getByText("Create new task (in current board)")).toBeTruthy();
      expect(screen.getByText("Show keyboard shortcuts")).toBeTruthy();
      expect(screen.getByText("Close dialog / sheet / search")).toBeTruthy();
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
});
