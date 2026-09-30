import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";

type QueryValue = string | number | boolean | undefined | null;

export type Query = Record<string, QueryValue>;

export type AsyncState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True while refreshing with data already on screen (avoids layout jumps). */
  refreshing: boolean;
  refetch: () => Promise<void>;
  setData: (value: T | null) => void;
};

/**
 * GET helper with loading / error / empty states.
 * `path` of null skips the request (used by conditional panels).
 */
export function useApi<T>(
  path: string | null,
  options: { query?: Query; skip?: boolean } = {},
): AsyncState<T> {
  const { query, skip = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path) && !skip);
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);
  const queryKey = JSON.stringify(query ?? {});

  const run = useCallback(async () => {
    if (!path || skip) {
      setLoading(false);
      return;
    }
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api<T>(path, { query: query ? (JSON.parse(queryKey) as Query) : undefined });
      setData(result);
      setError(null);
      hasData.current = true;
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(String(err), 0, String(err)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [path, skip, queryKey]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await run();
    })();
    return () => {
      active = false;
    };
  }, [run]);

  return { data, error, loading, refreshing, refetch: run, setData };
}

/** Imperative mutation helper with pending state and typed result. */
export function useMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
): {
  mutate: (input: TInput) => Promise<TOutput | null>;
  pending: boolean;
  error: ApiError | null;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (input: TInput) => {
      setPending(true);
      setError(null);
      try {
        const result = await fn(input);
        return result;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError(String(err), 0, String(err));
        if (mounted.current) setError(apiError);
        throw apiError;
      } finally {
        if (mounted.current) setPending(false);
      }
    },
    [fn],
  );

  return { mutate, pending, error };
}
