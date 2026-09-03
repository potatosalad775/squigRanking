// Rank distribution chart and average score. Chart.js is loaded on first open
// of the stats modal, so it never blocks the initial render.

import {
  columnValue, getConfig, getRankValues, getRoleColumn, rankColors, rankIndexOf, rowScore,
} from './config.ts';
import { t } from './i18n.ts';
import type { Lang, Row } from './types.ts';

const DEFAULT_CHART_LIB = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

const DEFAULT_COLORS = [
  '#6c63ff', '#00bfae', '#00bfff', '#4caf50', '#8bc34a',
  '#ffb347', '#ffc107', '#ff9800', '#ff5722', '#b71c1c',
];

interface ChartLike { destroy(): void }
type ChartCtor = new (ctx: CanvasRenderingContext2D, cfg: unknown) => ChartLike;

let chart: ChartLike | null = null;
let libPromise: Promise<ChartCtor | null> | null = null;

/** Load Chart.js once, on demand. Resolves null when the CDN is unreachable. */
function loadChartLib(): Promise<ChartCtor | null> {
  if (libPromise) return libPromise;
  const existing = (globalThis as { Chart?: ChartCtor }).Chart;
  if (existing) {
    libPromise = Promise.resolve(existing);
    return libPromise;
  }
  const url = getConfig().stats?.chartLibUrl ?? DEFAULT_CHART_LIB;
  libPromise = new Promise<ChartCtor | null>(resolve => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve((globalThis as { Chart?: ChartCtor }).Chart ?? null);
    script.onerror = () => {
      console.warn(`[squigRanking] could not load the chart library from ${url}`);
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return libPromise;
}

/** Count rows per rank value, index-aligned with the configured rank order. */
export function rankCounts(rows: Row[], lang: Lang): { labels: string[]; counts: number[] } {
  const labels = getRankValues();
  const column = getRoleColumn('rank');
  if (!column) return { labels: [], counts: [] };
  const counts = labels.map(() => 0);
  for (const row of rows) {
    const index = rankIndexOf(columnValue(row, column, lang));
    if (index !== -1) counts[index]! += 1;
  }
  return { labels, counts };
}

/**
 * Mean score across rows. A row with no numeric cell in `field` contributes the
 * score its rank scale assigns, so star and letter-grade sheets average without
 * a separate Score column. Rows that resolve to nothing are skipped.
 */
export function averageScore(rows: Row[], field: string, lang: Lang = 'en'): number | null {
  const values = rows
    .map(row => rowScore(row, lang, field))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function renderStats(rows: Row[], lang: Lang): Promise<void> {
  const stats = getConfig().stats ?? {};

  const averageEl = document.getElementById('avg-score');
  if (averageEl) {
    const field = stats.average?.source ?? 'Score';
    const average = averageScore(rows, field, lang);
    averageEl.textContent = average === null ? '-' : average.toFixed(2);
  }
  const denominatorEl = document.getElementById('avg-score-denominator');
  if (denominatorEl) {
    const denominator = stats.average?.denominator;
    denominatorEl.textContent = denominator ? `/ ${denominator}` : '';
  }

  const canvas = document.getElementById('rank-bar-chart');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const { labels, counts } = rankCounts(rows, lang);
  if (!labels.length) return;

  const Chart = await loadChartLib();
  const context = canvas.getContext('2d');
  if (!Chart || !context) return;

  chart?.destroy();
  chart = new Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: t('deviceCount', lang),
        data: counts,
        backgroundColor: stats.chartColors ?? (rankColors().length ? rankColors() : DEFAULT_COLORS),
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

/** Drop the cached chart so the next open rebuilds it. */
export function destroyStats(): void {
  chart?.destroy();
  chart = null;
}
