import path from 'path';
import { promises as fs } from 'fs';

export type Hike = {
  slug: string;
  name: string;
  region?: string;
  county?: string;
  difficulty?: string; // e.g. "easy" | "moderate" | "hard"
  distance_km?: number;
  ascent_m?: number;
  time_hours?: number;
  terrain?: string;
  terrain_summary?: string;
  safety_notes?: string[];
  summary?: string;
  start: {
    lat: number;
    lon: number;
    nearest_postcode?: string;
    car_park_name?: string;
  };
  gpx_file?: string;
};

const DATA_DIR = path.join(process.cwd(), 'data', 'hikes');

export async function getHikeBySlug(slug: string): Promise<Hike | null> {
  const filePath = path.join(DATA_DIR, `${slug}.json`);

  try {
    const file = await fs.readFile(filePath, 'utf8');
    return JSON.parse(file) as Hike;
  } catch (err) {
    console.error(`Hike not found for slug "${slug}"`, err);
    return null;
  }
}

export async function getAllHikes(): Promise<Hike[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const hikes: Hike[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const slug = file.replace(/\.json$/, '');
      const hike = await getHikeBySlug(slug);
      if (hike) hikes.push(hike);
    }

    return hikes;
  } catch (err) {
    console.error('Error reading hikes directory', err);
    return [];
  }
}

// --- Nearby hikes helper ----------------------------------------------

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find hikes near a given hike, based on start coordinates.
 */
export async function getNearbyHikes(
  slug: string,
  maxDistanceKm = 30,
  limit = 4
): Promise<Array<Hike & { distance_from_start_km: number }>> {
  const center = await getHikeBySlug(slug);
  if (!center) return [];

  const all = await getAllHikes();

  const withDistance = all
    .filter((h) => h.slug !== slug)
    .filter(
      (h) =>
        typeof h.start?.lat === 'number' && typeof h.start?.lon === 'number'
    )
    .map((h) => {
      const d = haversineKm(
        center.start.lat,
        center.start.lon,
        h.start.lat,
        h.start.lon
      );
      return { ...h, distance_from_start_km: d };
    })
    .filter((h) => h.distance_from_start_km <= maxDistanceKm)
    .sort((a, b) => a.distance_from_start_km - b.distance_from_start_km)
    .slice(0, limit);

  return withDistance;
}
