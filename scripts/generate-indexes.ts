// scripts/generate-indexes.ts
import fs from 'node:fs';
import path from 'node:path';
import { Hike } from './hike-types';

function readHikes(): Hike[] {
  const dir = path.join(process.cwd(), 'data', 'hikes');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const full = path.join(dir, file);
    return JSON.parse(fs.readFileSync(full, 'utf8')) as Hike;
  });
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const hikes = readHikes();
  const base = path.join(process.cwd(), 'data', 'indexes');
  ensureDir(base);

  // Difficulty indexes
  const byDifficulty = new Map<string, string[]>();
  for (const hike of hikes) {
    const key = hike.difficulty;
    if (!byDifficulty.has(key)) byDifficulty.set(key, []);
    byDifficulty.get(key)!.push(hike.slug);
  }

  const difficultyDir = path.join(base, 'difficulty');
  ensureDir(difficultyDir);
  for (const [difficulty, slugs] of byDifficulty.entries()) {
    const file = path.join(difficultyDir, `${difficulty}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({ difficulty, hikes: slugs }, null, 2),
      'utf8'
    );
  }

  // Theme indexes
  const byTheme = new Map<string, string[]>();
  for (const hike of hikes) {
    for (const theme of hike.themes ?? []) {
      if (!byTheme.has(theme)) byTheme.set(theme, []);
      byTheme.get(theme)!.push(hike.slug);
    }
  }
  const themeDir = path.join(base, 'themes');
  ensureDir(themeDir);
  for (const [theme, slugs] of byTheme.entries()) {
    const file = path.join(themeDir, `${theme}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({ theme, hikes: slugs }, null, 2),
      'utf8'
    );
  }

  console.log('Generated difficulty and theme indexes in data/indexes');
}

main();
