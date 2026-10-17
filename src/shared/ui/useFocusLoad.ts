/**
 * INTEGRATION CONTRACT: HOOK-UI-002
 * Purpose: how every screen loads data — on mount, when the screen regains focus, when its
 *          dependencies change, and after a backup restore. Results of superseded loads are
 *          discarded so a slow request can never overwrite fresh data.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (HOOK-UI-002)
 * Consumers: every screen
 * Contract status: APPROVED
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppEvent } from '../events/appEvents';
import { toAppError } from '../errors/AppError';
import type { DependencyList } from 'react';
import type { AppError } from '../errors/AppError';

export interface FocusLoadResult<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
  reload(): void;
}

/** HOOK-UI-002 */
export function useFocusLoad<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
): FocusLoadResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setLoading(true);
    try {
      const result = await loaderRef.current();
      if (!mountedRef.current || runIdRef.current !== runId) {
        return;
      }
      setData(result);
      setError(null);
    } catch (e) {
      if (!mountedRef.current || runIdRef.current !== runId) {
        return;
      }
      setError(toAppError(e));
    } finally {
      if (mountedRef.current && runIdRef.current === runId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Loading on mount/dependency change is exactly this hook's job; the setState inside `run`
    // is what drives the loading flag the screen renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    // `deps` is intentionally the caller's dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );

  useAppEvent('data.restored', () => {
    void run();
  });

  return { data, loading, error, reload: run };
}