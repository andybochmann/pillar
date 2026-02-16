import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFooter } from "./marketing-footer";

describe("MarketingFooter", () => {
  it("renders copyright text", () => {
    render(<MarketingFooter isAuthenticated={false} />);

    expect(screen.getByText(/Pillar/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it("renders privacy and terms links", () => {
    render(<MarketingFooter isAuthenticated={false} />);

    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /terms of service/i })).toHaveAttribute("href", "/terms");
  });

  it("shows Sign In link when not authenticated", () => {
    render(<MarketingFooter isAuthenticated={false} />);

    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/login");
  });

  it("shows Dashboard link when authenticated", () => {
    render(<MarketingFooter isAuthenticated={true} />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/home");
  });
});
