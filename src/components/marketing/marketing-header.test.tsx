import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingHeader } from "./marketing-header";

describe("MarketingHeader", () => {
  it("renders logo and nav links", () => {
    render(<MarketingHeader isAuthenticated={false} />);

    expect(screen.getByText("Pillar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute("href", "/terms");
  });

  it("shows Sign In button when not authenticated", () => {
    render(<MarketingHeader isAuthenticated={false} />);

    const signInLink = screen.getByRole("link", { name: "Sign In" });
    expect(signInLink).toHaveAttribute("href", "/login");
  });

  it("shows Go to App button when authenticated", () => {
    render(<MarketingHeader isAuthenticated={true} />);

    const appLink = screen.getByRole("link", { name: "Go to App" });
    expect(appLink).toHaveAttribute("href", "/home");
  });
});
