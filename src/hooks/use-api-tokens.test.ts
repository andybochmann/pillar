import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiTokens } from "./use-api-tokens";

describe("useApiTokens", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches tokens on call", async () => {
    const mockTokens = [
      {
        _id: "1",
        name: "Token 1",
        tokenPrefix: "plt_aaaa",
        lastUsedAt: null,
        expiresAt: null,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokens),
    } as Response);

    const { result } = renderHook(() => useApiTokens());

    await act(async () => {
      await result.current.fetchTokens();
    });

    expect(result.current.tokens).toEqual(mockTokens);
    expect(result.current.loading).toBe(false);
  });

  it("createToken calls POST and updates state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          _id: "2",
          name: "New Token",
          tokenPrefix: "plt_bbbb",
          token: "plt_full_raw_token_value",
          createdAt: "2025-01-02T00:00:00.000Z",
        }),
    } as Response);

    const { result } = renderHook(() => useApiTokens());

    let rawToken: string;
    await act(async () => {
      rawToken = await result.current.createToken("New Token");
    });

    expect(rawToken!).toBe("plt_full_raw_token_value");
    expect(result.current.tokens).toHaveLength(1);
    expect(result.current.tokens[0].name).toBe("New Token");
  });

  it("revokeToken calls DELETE and removes from state", async () => {
    // First populate state
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              _id: "1",
              name: "Token 1",
              tokenPrefix: "plt_aaaa",
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

    const { result } = renderHook(() => useApiTokens());

    await act(async () => {
      await result.current.fetchTokens();
    });
    expect(result.current.tokens).toHaveLength(1);

    await act(async () => {
      await result.current.revokeToken("1");
    });
    expect(result.current.tokens).toHaveLength(0);
  });

  it("handles error on fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    } as Response);

    const { result } = renderHook(() => useApiTokens());

    await act(async () => {
      await result.current.fetchTokens();
    });

    expect(result.current.error).toBe("Server error");
  });
});
