import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BetaNotice } from "./beta-notice";

describe("BetaNotice", () => {
  it("renders the beta heading", () => {
    render(<BetaNotice />);
    expect(screen.getByText(/beta software/i)).toBeInTheDocument();
  });

  it("mentions free of charge and data loss disclaimer", () => {
    render(<BetaNotice />);
    expect(screen.getByText(/free of charge/i)).toBeInTheDocument();
    expect(screen.getByText(/data loss/i)).toBeInTheDocument();
  });
});
