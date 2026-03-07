import { useState, useEffect, useCallback, useRef } from "react";
import type { FilledBundle } from "@/types/content";

interface BundleLoaderState {
  currentBundle: FilledBundle | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to load and cache filled bundles.
 * Listens for bundle-ready events (bundleId changes) and fetches bundle data.
 * Caches loaded bundles in memory to avoid redundant fetches.
 */
export function useBundleLoader(bundleId: string | null): BundleLoaderState {
  const [currentBundle, setCurrentBundle] = useState<FilledBundle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, FilledBundle>>(new Map());

  const loadBundle = useCallback(async (id: string) => {
    // Check cache first
    const cached = cacheRef.current.get(id);
    if (cached) {
      setCurrentBundle(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/bundles/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch bundle: ${res.statusText}`);
      const bundle: FilledBundle = await res.json();

      cacheRef.current.set(id, bundle);
      setCurrentBundle(bundle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setCurrentBundle(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bundleId) {
      setCurrentBundle(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    loadBundle(bundleId);
  }, [bundleId, loadBundle]);

  return { currentBundle, isLoading, error };
}
