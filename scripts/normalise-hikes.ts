// scripts/normalise-hikes.ts
import fs from 'node:fs';
import path from 'node:path';
import { RawOsmHike, Hike, Difficulty, ThemeTag, TransportTag } from './hike-types';

function readRawOsmDir(): RawOsmHike[] {
  const dir = path.join(process.cwd(), 'data', 'raw', 'osm');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const full = path.join(dir, file);
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    return json as RawOsmHike;
  });
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const la1 = (lat1 * Math.PI) / 180;
  const la2 = (lat2 * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function estimateDistanceKm(coords: [number, number][]): number {
  let dist = 0;
  for (let i = 1; i < coords.length; i++) {
    dist += haversineKm(coords[i - 1], coords[i]);
  }
  return Math.round(dist * 10) / 10;
}

// VERY crude difficulty heuristic; you can refine later
function guessDifficulty(distanceKm: number): Difficulty {
  if (distanceKm < 6) return 'easy';
  if (distanceKm < 15) return 'moderate';
  return 'hard';
}

// Placeholder theming – we’ll improve with AI later if you like
function guessThemes(tags: Record<string, string>): ThemeTag[] {
  const themes: ThemeTag[] = [];
  const name = (tags.name || '').toLowerCase();
  const desc = (tags.description || '').toLowerCase();

  const text = name + ' ' + desc;

  if (text.includes('coast') || text.includes('bay')) themes.push('coastal');
  if (text.includes('waterfall') || text.includes('falls')) themes.push('waterfalls');
  if (text.includes('lake') || text.includes('mere') || text.includes('tarn'))
    themes.push('lakes');
  if (text.includes('ridge') || text.includes('edge')) themes.push('ridges');

  return [...new Set(themes)];
}

function defaultTransport(): TransportTag[] {
  // For now we just assume car-free possible is unknown – you’ll enrich with real data later.
  return [];
}

function guessRegion(tags: Record<string, string>): {
  region: string;
  country: Hike['country'];
} {
  // OSM often has 'state' or 'country' tags but not always.
  const countryTag = tags['addr:country'] ?? 'GB';
  let country: Hike['country'] = 'UK';
  if (countryTag === 'GB' || countryTag === 'UK') {
    // Some relations have 'is_in:country' etc. For v1 we keep it simple.
    country = 'UK';
  }

  const region =
    tags['is_in:county'] ||
    tags['addr:county'] ||
    tags['is_in:region'] ||
    'Unknown region';

  return { region, country };
}

function normalise(raw: RawOsmHike): Hike {
  const distanceKm = estimateDistanceKm(raw.coordinates);
  const difficulty = guessDifficulty(distanceKm);
  const themes = guessThemes(raw.tags);
  const transportTags = defaultTransport();

  const [startLon, startLat] = raw.coordinates[0];
  const { region, country } = guessRegion(raw.tags);

  const hike: Hike = {
    id: `osm-${raw.id}`,
    slug: raw.slug,
    name: raw.name,
    region,
    country,

    distanceKm,
    difficulty,
    themes,
    transport: { access_tags: transportTags },
    start: { lat: startLat, lon: startLon },
    source: {
      type: 'osm',
      osmId: raw.id,
    },
  };

  return hike;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const rawHikes = readRawOsmDir();
  const outDir = path.join(process.cwd(), 'data', 'hikes');
  ensureDir(outDir);

  let count = 0;
  for (const raw of rawHikes) {
    const hike = normalise(raw);
    const outFile = path.join(outDir, `${hike.slug}.json`);
    fs.writeFileSync(outFile, JSON.stringify(hike, null, 2), 'utf8');
    count++;
  }

  console.log(`Normalised ${count} hikes into ${outDir}`);
}

main();
