import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSection } from "./hero-section";

describe("HeroSection", () => {
  it("renders heading", () => {
    render(<HeroSection />);

    expect(
      screen.getByRole("heading", { name: /organize your work with pillar/i }),
    ).toBeInTheDocument();
  });

  it("renders Get Started link to register", () => {
    render(<HeroSection />);

    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/register");
  });

  it("renders Sign In link to login", () => {
    render(<HeroSection />);

    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/login");
  });
});
