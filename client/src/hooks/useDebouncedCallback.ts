import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounce a callback: rapid calls collapse into a single invocation after
 * `delay` ms of quiet. Returns `[run, flush, cancel]`.
 * - `flush()` runs the latest pending call immediately (use on blur).
 * - `cancel()` drops it (use on Escape/revert).
 * On unmount, any pending call is flushed so an in-flight edit is never lost.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): [(...args: A) => void, () => void, () => void] {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);
  const callbackRef = useRef(callback);

  // Keep the latest callback without re-creating `run` (updated outside render).
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (pending.current !== null) {
      clearTimer();
      const args = pending.current;
      pending.current = null;
      callbackRef.current(...args);
    }
  }, [clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    pending.current = null;
  }, [clearTimer]);

  const run = useCallback(
    (...args: A) => {
      pending.current = args;
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        const args2 = pending.current;
        pending.current = null;
        if (args2 !== null) {
          callbackRef.current(...args2);
        }
      }, delay);
    },
    [clearTimer, delay],
  );

  // Flush any pending call on unmount so a debounced edit isn't dropped.
  useEffect(() => flush, [flush]);

  return [run, flush, cancel];
}
