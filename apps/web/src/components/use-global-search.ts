"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: string;
  id: string;
  label: string;
  href: string;
}

export function useGlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const onSelect = useCallback((href: string) => {
    setQuery("");
    setResults([]);
    router.push(href);
  }, [router]);

  return { query, setQuery, results, onSelect };
}
