import { useEffect, useRef } from 'react';

/**
 * Lightweight render profiler for development.
 * - Logs render counts and time between renders to the console.
 * - Adds Performance API marks/measures per render so you can inspect them
 *   in the browser Performance panel (DevTools → Performance).
 */
export function useRenderPerf(name: string) {
  const renders = useRef(0);
  renders.current += 1;
  const tick = renders.current;

  const startMark = `${name}-start-${tick}`;
  const endMark = `${name}-end-${tick}`;

  // Mark at render start (this runs during render)
  try { performance.mark(startMark); } catch {}

  useEffect(() => {
    // Mark after paint and measure the render duration
    try {
      performance.mark(endMark);
      const measureName = `${name} render #${tick}`;
      performance.measure(measureName, startMark, endMark);
      const entries = performance.getEntriesByName(measureName, 'measure');
      if (entries && entries.length) {
        console.debug(`[perf] ${name} ${measureName} ${entries[0].duration.toFixed(1)}ms`);
      } else {
        // Fallback delta logging if measure not available
        console.debug(`[perf] ${name} render #${tick}`);
      }
      // Clear to avoid unbounded growth
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);
    } catch (e) {
      // ignore in environments without Performance API
    }

    return () => {
      console.debug(`[perf] ${name} unmounted after ${renders.current} renders`);
    };
  }); // no deps -> runs after every render
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
  } catch (e) {
    console.warn('[perf] dumpPerfMeasures failed', e);
  }
}
