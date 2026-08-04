import { useEffect, useRef } from 'react';

/**
 * Lightweight render profiler for development.
 * - Logs render counts to the console (measured once per commit, in a useEffect —
 *   never mutate refs during render, since render must stay a pure function).
 * - Adds Performance API marks so you can inspect them in the browser
 *   Performance panel (DevTools → Performance).
 */
export function useRenderPerf(name: string) {
  const renders = useRef(0);

  useEffect(() => {
    if (typeof performance === 'undefined') return;

    renders.current += 1;
    const tick = renders.current;
    const markName = `${name}-render-${tick}`;

    performance.mark(markName);
    console.debug(`[perf] ${name} render #${tick}`);
    performance.clearMarks(markName);

    return () => {
      console.debug(`[perf] ${name} unmounted after ${renders.current} renders`);
    };
  });
}

/**
 * Print a compact summary of collected Performance measures to the console.
 * Use it from the browser console after exercising the UI: e.g.
 * `import { dumpPerfMeasures } from './utils/perf'; dumpPerfMeasures();`
 */
export function dumpPerfMeasures(clear = true) {
  try {
    const measures = performance.getEntriesByType('measure') as PerformanceMeasure[];
    if (!measures || measures.length === 0) {
      console.info('[perf] no measures collected');
      return;
    }

    const summary: Record<string, { total: number; count: number }> = {};
    for (const m of measures) {
      const s = summary[m.name] || { total: 0, count: 0 };
      s.total += m.duration;
      s.count += 1;
      summary[m.name] = s;
    }

    const rows = Object.entries(summary).map(([name, v]) => ({
      name,
      avg: (v.total / v.count).toFixed(1) + 'ms',
      total: v.total.toFixed(1) + 'ms',
      count: v.count,
    }));

    console.table(rows);
    if (clear) performance.clearMeasures();
  } catch (err) {
    console.warn('[perf] dumpPerfMeasures failed', err);
  }
}
