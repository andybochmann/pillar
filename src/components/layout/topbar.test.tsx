import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "./topbar";

describe("Topbar", () => {
  it("renders hamburger button and app title", () => {
    render(<Topbar onMenuToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Toggle menu" })).toBeTruthy();
    expect(screen.getByText("Pillar")).toBeTruthy();
  });

  it("calls onMenuToggle when hamburger clicked", () => {
    const toggle = vi.fn();
    render(<Topbar onMenuToggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    expect(toggle).toHaveBeenCalledOnce();
  });
});
