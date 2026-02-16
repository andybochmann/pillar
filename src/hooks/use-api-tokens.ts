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

/**
 * Manages API access token state with CRUD operations and optimistic updates.
 *
 * This hook provides a complete interface for managing user API tokens, including:
 * - Local state management with optimistic updates
 * - Token creation with secure one-time token retrieval
 * - Token revocation (deletion)
 * - Manual fetching of token list
 *
 * @returns {UseApiTokensReturn} Object containing:
 *   - `tokens`: Array of access tokens (without actual token values, only metadata)
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `fetchTokens`: Function to manually fetch all tokens for the current user
 *   - `createToken`: Function to create a new token, returns the actual token string (only shown once)
 *   - `revokeToken`: Function to revoke (delete) a token with optimistic update
 *
 * @example
 * ```tsx
 * function ApiTokensPage() {
 *   const {
 *     tokens,
 *     loading,
 *     error,
 *     fetchTokens,
 *     createToken,
 *     revokeToken
 *   } = useApiTokens();
 *
 *   useEffect(() => {
 *     fetchTokens();
 *   }, []);
 *
 *   const handleCreateToken = async (name: string) => {
 *     try {
 *       const tokenValue = await createToken(name);
 *       // Token value is only available once - must be saved by user
 *       setShowTokenDialog(tokenValue);
 *       toast.success("Token created - copy it now, it won't be shown again");
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleRevokeToken = async (tokenId: string) => {
 *     try {
 *       await revokeToken(tokenId);
 *       toast.success("Token revoked successfully");
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   if (loading) return <Spinner />;
 *   return (
 *     <div>
 *       {tokens.map(token => (
 *         <TokenRow
 *           key={token._id}
 *           token={token}
 *           onRevoke={handleRevokeToken}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Uses standard `fetch` (not `offlineFetch`) - mutations fail when offline
 * - No real-time synchronization - tokens must be manually refetched to see changes from other sessions
 * - Optimistic updates are applied immediately to local state
 * - `createToken` returns the actual token string, which is only available once for security reasons
 * - Subsequent fetches only return token metadata (name, created date, last used) without the token value
 */
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
