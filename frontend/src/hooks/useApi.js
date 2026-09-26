import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an async request fn, returns { data, error, loading, reload }. */
export function useApi(fn, { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) reload().catch(() => {});
  }, [immediate, reload]);

  return { data, error, loading, reload };
}
