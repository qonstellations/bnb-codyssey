import { useEffect, useRef } from "react";

/** Calls `fn` every `ms`, stops on unmount. Skips overlapping calls. */
export function usePolling(fn, ms = 5000, { active = true } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;
    let busy = false;
    let cancelled = false;
    const tick = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        await fnRef.current();
      } catch {
        // polling errors are swallowed — the caller surfaces state via its own hook
      } finally {
        busy = false;
      }
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ms, active]);
}
