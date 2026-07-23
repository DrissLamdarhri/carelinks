import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Stale-while-revalidate focus refresh.
 *
 * Screens used to re-query Supabase on EVERY focus, so each bottom-bar tab
 * switch fired profile + list fetches again — the main source of perceived lag.
 * This runs the work on first focus, then skips it while the data is still
 * fresh (`ttlMs`). Already-rendered data stays on screen, so switching tabs is
 * instant and the network is only touched when it's actually worth it.
 *
 * Pass ttlMs = 0 to force a refresh on every focus (e.g. after a mutation).
 */
export function useFocusRefresh(run: () => void | Promise<void>, ttlMs = 30_000) {
  const lastRunAt = useRef(0);
  const runRef = useRef(run);

  // Keep the latest closure without re-subscribing the focus effect.
  useEffect(() => {
    runRef.current = run;
  });

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (ttlMs > 0 && now - lastRunAt.current < ttlMs) return; // still fresh
      lastRunAt.current = now;
      void runRef.current();
    }, [ttlMs])
  );
}
