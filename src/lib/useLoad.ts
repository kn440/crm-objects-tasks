import { useCallback, useEffect, useState } from 'react';

const isNetworkError = (e: unknown) => /Failed to fetch|NetworkError|Load failed/i.test(String((e as Error)?.message ?? e));

/** Загрузка данных с перезагрузкой по запросу. При обрыве связи — одна повторная попытка. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        setData(await run());
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        await new Promise((r) => setTimeout(r, 800));
        setData(await run());
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
