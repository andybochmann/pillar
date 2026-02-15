import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiTokensCard } from "./api-tokens-card";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ApiTokensCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default: return empty tokens
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);
    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  it("renders empty state when no tokens exist", async () => {
    render(<ApiTokensCard />);
    await waitFor(() => {
      expect(screen.getByText("No API tokens yet")).toBeInTheDocument();
    });
  });

  it("renders API Tokens heading", () => {
    render(<ApiTokensCard />);
    expect(screen.getByText("API Tokens")).toBeInTheDocument();
  });

  it("renders MCP server URL", () => {
    render(<ApiTokensCard />);
    expect(screen.getByText(/\/api\/mcp/)).toBeInTheDocument();
  });

  it("renders token list with names and prefixes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            _id: "1",
            name: "Claude Desktop",
            tokenPrefix: "plt_a1b2",
            lastUsedAt: "2025-06-01T00:00:00.000Z",
            expiresAt: null,
            createdAt: "2025-01-01T00:00:00.000Z",
          },
        ]),
    } as Response);

    render(<ApiTokensCard />);
    await waitFor(() => {
      expect(screen.getByText("Claude Desktop")).toBeInTheDocument();
    });
    expect(screen.getByText(/plt_a1b2/)).toBeInTheDocument();
  });

  it("create button calls API and shows one-time token dialog", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            _id: "2",
            name: "New Token",
            tokenPrefix: "plt_bbbb",
            token: "plt_fulltoken1234567890",
            createdAt: "2025-01-02T00:00:00.000Z",
          }),
      } as Response);

    render(<ApiTokensCard />);

    const input = screen.getByPlaceholderText(/Token name/);
    await user.type(input, "New Token");
    await user.click(screen.getByText("Create token"));

    await waitFor(() => {
      expect(screen.getByText("Token created")).toBeInTheDocument();
    });
    expect(
      screen.getByText("plt_fulltoken1234567890"),
    ).toBeInTheDocument();
  });

  it("revoke button calls API and removes token from list", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              _id: "1",
              name: "To Revoke",
              tokenPrefix: "plt_cccc",
              lastUsedAt: null,
              expiresAt: null,
              createdAt: "2025-01-01T00:00:00.000Z",
            },
          ]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

    render(<ApiTokensCard />);

    await waitFor(() => {
      expect(screen.getByText("To Revoke")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Revoke To Revoke"));

    await waitFor(() => {
      expect(screen.queryByText("To Revoke")).not.toBeInTheDocument();
    });
  });
});
