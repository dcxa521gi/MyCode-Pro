import { useCallback, useEffect, useRef } from "react";

const DELAY_MS = 300;
const MAX_DRIFT = 12;

/** Recovers a tap when Android's keyboard cancels the Pressable gesture before onPress. */
export function useAndroidPressFallback(enabled: boolean, action: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const handled = useRef(false);
  const actionRef = useRef(action);
  useEffect(() => { actionRef.current = action; }, [action]);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    if (!enabled) cancel();
  }, [cancel, enabled]);

  const begin = useCallback((x: number, y: number) => {
    cancel();
    handled.current = false;
    origin.current = { x, y };
    if (!enabled) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      handled.current = true;
      actionRef.current();
    }, DELAY_MS);
  }, [cancel, enabled]);

  const move = useCallback((x: number, y: number) => {
    if (timer.current !== null && origin.current &&
      Math.hypot(x - origin.current.x, y - origin.current.y) > MAX_DRIFT) {
      cancel();
      handled.current = true;
    }
  }, [cancel]);

  const finish = useCallback(() => {
    cancel();
    const skip = handled.current;
    handled.current = false;
    if (!skip) actionRef.current();
  }, [cancel]);

  return { begin, move, finish };
}
