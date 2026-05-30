import { useEffect, useRef } from 'react';

/**
 * Lightweight render profiler for development.
 * Logs render counts and time between renders to the console.
 */
export function useRenderPerf(name: string) {
  const renders = useRef(0);
  const last = useRef<number>(performance.now());
  renders.current += 1;

  useEffect(() => {
    const now = performance.now();
    const delta = now - last.current;
    // Use console.debug so it can be filtered easily in devtools
    console.debug(`[perf] ${name} render #${renders.current} (+${delta.toFixed(1)}ms)`);
    last.current = now;
  }); // no deps -> runs after every render

  useEffect(() => {
    return () => {
      console.debug(`[perf] ${name} unmounted after ${renders.current} renders`);
    };
  }, []);
}
