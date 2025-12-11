// src/app/admin/enrichment-dashboard/page.tsx
import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hike Enrichment Dashboard | Admin',
  description: 'Progress overview for AI-enriched hikes.',
};

interface HikeStats {
  total: number;
  enriched: number;
  remaining: number;
  percent: number;
  difficulties: Record<string, number>;
  themes: Record<string, number>;
}

async function getStats(): Promise<HikeStats | null> {
  const statsPath = path.join(process.cwd(), 'data', 'hikes-stats.json');

  if (!fs.existsSync(statsPath)) {
    return null;
  }

  const raw = fs.readFileSync(statsPath, 'utf8');
  return JSON.parse(raw) as HikeStats;
}

export const revalidate = 0;

export default async function EnrichmentDashboardPage() {
  const stats = await getStats();

  if (!stats) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">
          Hike Enrichment Dashboard
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          No stats file found yet. Run{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            pnpm hikes:stats
          </code>{' '}
          from the project root to generate{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            data/hikes-stats.json
          </code>
          .
        </p>
      </main>
    );
  }

  const percentLabel = `${stats.percent.toFixed(1)}%`;

  const difficultyEntries = Object.entries(stats.difficulties);
  const themeEntries = Object.entries(stats.themes).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Hike Enrichment Dashboard
        </h1>
        <p className="text-sm text-gray-600">
          Overview of AI enrichment progress for all hikes in{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            data/hikes
          </code>
          .
        </p>
      </header>

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium text-gray-500 uppercase">
            Total hikes
          </h2>
          <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium text-gray-500 uppercase">
            Enriched
          </h2>
          <p className="mt-2 text-2xl font-semibold">{stats.enriched}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium text-gray-500 uppercase">
            Remaining
          </h2>
          <p className="mt-2 text-2xl font-semibold">{stats.remaining}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium text-gray-500 uppercase">
            Completion
          </h2>
          <p className="mt-2 text-2xl font-semibold">{percentLabel}</p>
        </div>
      </section>

      {/* Progress bar */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">
          Overall enrichment progress
        </h2>
        <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(stats.percent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {stats.enriched} of {stats.total} hikes enriched ({percentLabel})
        </p>
      </section>

      {/* Breakdown grids */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            By difficulty
          </h2>
          <ul className="space-y-2 text-sm">
            {difficultyEntries.map(([difficulty, count]) => (
              <li key={difficulty} className="flex items-center justify-between">
                <span className="capitalize text-gray-700">
                  {difficulty}
                </span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            Top themes
          </h2>
          <ul className="space-y-2 text-sm max-h-64 overflow-y-auto pr-1">
            {themeEntries.map(([theme, count]) => (
              <li key={theme} className="flex items-center justify-between">
                <span className="capitalize text-gray-700">
                  {theme.replace(/-/g, ' ')}
                </span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t pt-4 text-xs text-gray-500">
        <p>
          To refresh these numbers, run{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">pnpm hikes:stats</code>{' '}
          after adding or enriching hikes.
        </p>
      </footer>
    </main>
  );
}
