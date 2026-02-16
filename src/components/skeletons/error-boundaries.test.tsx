import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardError from "@/app/(dashboard)/error";
import AuthError from "@/app/(auth)/error";
import ProjectNotFound from "@/app/(dashboard)/projects/[id]/not-found";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("Error boundaries", () => {
  it("DashboardError renders error message and retry button", () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error("Test failure")} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Test failure")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("DashboardError shows default message when error has no message", () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error("")} reset={reset} />);

    expect(
      screen.getByText("An unexpected error occurred while loading this page."),
    ).toBeTruthy();
  });

  it("AuthError renders error message and retry button", () => {
    const reset = vi.fn();
    render(<AuthError error={new Error("Auth failed")} reset={reset} />);

    expect(screen.getByText("Authentication Error")).toBeTruthy();
    expect(screen.getByText("Auth failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("ProjectNotFound shows not found message with back link", () => {
    render(<ProjectNotFound />);

    expect(screen.getByText("Project not found")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Back to Dashboard" });
    expect(link.getAttribute("href")).toBe("/home");
  });
});
