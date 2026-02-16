import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SocialLoginButtons } from "./social-login-buttons";

const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSignIn.mockClear();
  });

  it("renders nothing when no OAuth providers are available", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ credentials: { id: "credentials", name: "Credentials" } })),
    );

    const { container } = render(<SocialLoginButtons />);

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("renders Google button when Google provider is available", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          credentials: { id: "credentials", name: "Credentials" },
          google: { id: "google", name: "Google" },
        }),
      ),
    );

    render(<SocialLoginButtons />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    });
  });

  it("calls signIn with provider id on click", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          google: { id: "google", name: "Google" },
        }),
      ),
    );

    render(<SocialLoginButtons />);

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /google/i }));

    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });

  it("shows divider text", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          google: { id: "google", name: "Google" },
        }),
      ),
    );

    render(<SocialLoginButtons />);

    await waitFor(() => {
      expect(screen.getByText("Or continue with")).toBeInTheDocument();
    });
  });

  it("handles fetch failure gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const { container } = render(<SocialLoginButtons />);

    // Should remain empty after failed fetch
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });
});
