import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CtaSection } from "./cta-section";

describe("CtaSection", () => {
  it("renders heading", () => {
    render(<CtaSection />);

    expect(
      screen.getByRole("heading", { name: /ready to get organized/i }),
    ).toBeInTheDocument();
  });

  it("renders Create Free Account link to register", () => {
    render(<CtaSection />);

    expect(
      screen.getByRole("link", { name: "Create Free Account" }),
    ).toHaveAttribute("href", "/register");
  });
});
