import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an async request fn, returns { data, error, loading, reload }. */
export function useApi(fn, { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const loaded = useRef(false);

  // Only the first load flips `loading`; later reloads swap data in place so pages don't flash.
  const reload = useCallback(async () => {
    if (!loaded.current) setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      loaded.current = true;
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
