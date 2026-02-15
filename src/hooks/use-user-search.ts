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
