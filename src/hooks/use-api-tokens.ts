"use client";

import { useState, useCallback } from "react";
import type { AccessToken } from "@/types";

interface UseApiTokensReturn {
  tokens: AccessToken[];
  loading: boolean;
  error: string | null;
  fetchTokens: () => Promise<void>;
  createToken: (name: string) => Promise<string>;
  revokeToken: (id: string) => Promise<void>;
}

export function useApiTokens(): UseApiTokensReturn {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/settings/tokens");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch tokens");
      }
      setTokens(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createToken = useCallback(async (name: string): Promise<string> => {
    const res = await fetch("/api/settings/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to create token");
    }
    const data = await res.json();
    const { token, ...tokenData } = data;
    setTokens((prev) => [
      { ...tokenData, lastUsedAt: null, expiresAt: null },
      ...prev,
    ]);
    return token;
  }, []);

  const revokeToken = useCallback(async (id: string) => {
    const res = await fetch(`/api/settings/tokens/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to revoke token");
    }
    setTokens((prev) => prev.filter((t) => t._id !== id));
  }, []);

  return { tokens, loading, error, fetchTokens, createToken, revokeToken };
}
