import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedAccountsCard } from "./connected-accounts-card";

const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

describe("ConnectedAccountsCard", () => {
  it("shows credentials as connected", () => {
    render(<ConnectedAccountsCard providers={["credentials"]} />);

    expect(screen.getByText("Email & Password")).toBeInTheDocument();
    expect(screen.getAllByText("Connected")).toHaveLength(1);
  });

  it("shows Connect button for unlinked Google", () => {
    render(<ConnectedAccountsCard providers={["credentials"]} />);

    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("shows all providers as connected", () => {
    render(
      <ConnectedAccountsCard providers={["credentials", "google"]} />,
    );

    expect(screen.getAllByText("Connected")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();
  });

  it("calls signIn when Connect is clicked", async () => {
    render(<ConnectedAccountsCard providers={["credentials"]} />);

    const user = userEvent.setup();
    const connectButtons = screen.getAllByRole("button", { name: "Connect" });
    await user.click(connectButtons[0]);

    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/settings" });
  });
});
