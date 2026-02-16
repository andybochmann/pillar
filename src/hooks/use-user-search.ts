"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SearchUser {
  _id: string;
  name: string;
  email: string;
  image?: string;
}

interface UseUserSearchReturn {
  results: SearchUser[];
  loading: boolean;
  search: (query: string) => void;
  clear: () => void;
}

/**
 * Provides debounced user search by email for project sharing and collaboration features.
 *
 * This hook manages user search state with automatic debouncing (300ms) and validation.
 * It queries the `/api/users/search` endpoint to find users by email address, returning
 * user profiles for display in autocomplete components or member invitation dialogs.
 *
 * @returns {UseUserSearchReturn} Object containing:
 *   - `results`: Array of matching users with id, name, email, and optional image
 *   - `loading`: Boolean indicating if a search request is in progress
 *   - `search`: Function to initiate search with debouncing (minimum 2 characters required)
 *   - `clear`: Function to reset search results and cancel pending debounced requests
 *
 * @example
 * ```tsx
 * function InviteMemberDialog({ projectId }: { projectId: string }) {
 *   const { results, loading, search, clear } = useUserSearch();
 *   const [email, setEmail] = useState("");
 *
 *   const handleInputChange = (value: string) => {
 *     setEmail(value);
 *     search(value); // Debounced automatically
 *   };
 *
 *   const handleSelect = (user: SearchUser) => {
 *     inviteUser(projectId, user._id);
 *     clear();
 *     setEmail("");
 *   };
 *
 *   return (
 *     <div>
 *       <Input
 *         value={email}
 *         onChange={(e) => handleInputChange(e.target.value)}
 *         placeholder="Search by email..."
 *       />
 *       {loading && <Spinner />}
 *       {results.map((user) => (
 *         <UserOption key={user._id} user={user} onSelect={handleSelect} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Debounces search input by 300ms to avoid excessive API calls
 * - Clears results immediately if query is less than 2 characters
 * - Cleans up pending timeouts on unmount to prevent memory leaks
 * - Silently handles search errors (no toast or throw) to avoid disrupting UX
 *
 * **Implementation Details:**
 * - Uses `useRef` to track debounce timeout without triggering re-renders
 * - Cancels previous timeout when new search is initiated
 * - Minimum query length of 2 characters enforced client-side
 * - Error responses from API are silently ignored (results remain unchanged)
 */
export function useUserSearch(): UseUserSearchReturn {
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?email=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // Silently fail on search errors
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { results, loading, search, clear };
}
