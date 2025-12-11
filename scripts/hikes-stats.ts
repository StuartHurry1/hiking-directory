// scripts/hikes-stats.ts
//
// Scans data/hikes/*.json and writes data/hikes-stats.json
// for use by the admin enrichment dashboard.

import fs from 'node:fs';
import path from 'node:path';
import type { Hike } from './hike-types';

type Difficulty = Hike['difficulty'];
type Theme = Hike['themes'][number];

interface HikeStats {
  total: number;
  enriched: number;
  remaining: number;
  percent: number;
  difficulties: Record<Difficulty, number>;
  themes: Record<string, number>;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadHikes(): Hike[] {
  const hikesDir = path.join(process.cwd(), 'data', 'hikes');
  if (!fs.existsSync(hikesDir)) {
    console.error(`Hikes directory not found: ${hikesDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(hikesDir).filter((f) => f.endsWith('.json'));
  const hikes: Hike[] = files.map((file) => {
    const full = path.join(hikesDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    return JSON.parse(raw) as Hike;
  });

  return hikes;
}

function computeStats(hikes: Hike[]): HikeStats {
  const total = hikes.length;
  let enriched = 0;

  const difficulties: Record<Difficulty, number> = {
    easy: 0,
    moderate: 0,
    hard: 0,
  };

  const themes: Record<string, number> = {};

  for (const hike of hikes) {
    if (hike.ai) enriched++;

    const d = hike.difficulty;
    if (difficulties[d] === undefined) {
      difficulties[d] = 0 as any;
    }
    difficulties[d]++;

    for (const theme of hike.themes ?? []) {
      themes[theme] = (themes[theme] ?? 0) + 1;
    }
  }

  const remaining = total - enriched;
  const percent = total === 0 ? 0 : (enriched / total) * 100;

  return {
    total,
    enriched,
    remaining,
    percent,
    difficulties,
    themes,
  };
}

function saveStats(stats: HikeStats) {
  const dataDir = path.join(process.cwd(), 'data');
  ensureDir(dataDir);

  const outFile = path.join(dataDir, 'hikes-stats.json');
  fs.writeFileSync(outFile, JSON.stringify(stats, null, 2), 'utf8');

  console.log(`Wrote stats to ${outFile}`);
}

function main() {
  console.log('--- Hike stats ---');
  const hikes = loadHikes();
  const stats = computeStats(hikes);
  saveStats(stats);

  console.log(
    `Total: ${stats.total}, Enriched: ${stats.enriched}, Remaining: ${stats.remaining}, ` +
      `Percent: ${stats.percent.toFixed(1)}%`
  );
}

main();
