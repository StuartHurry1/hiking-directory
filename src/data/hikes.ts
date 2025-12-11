// Central place for all your hike data & types

export type TransportAccessTag =
  | 'train-accessible'
  | 'bus-accessible'
  | 'car-free-possible';

export type HikeTheme = 'coastal' | 'waterfalls' | 'lakes' | 'ridges';

export type Difficulty = 'easy' | 'moderate' | 'challenging';

export type Hike = {
  id: string;
  slug: string;
  name: string;
  region: string;
  summary: string;
  distanceKm: number;
  ascentM: number;
  difficulty: Difficulty;
  themes: HikeTheme[];
  location: {
    lat: number;
    lon: number;
  };
  transport?: {
    access_tags?: TransportAccessTag[];
  };
};

// 🟢 Replace these 4 hikes with your *real* ones later.
// For now they give you a working structure.
export const hikes: Hike[] = [
  {
    id: 'stanage-edge-ridge-walk',
    slug: 'stanage-edge-ridge-walk',
    name: 'Stanage Edge Ridge Walk',
    region: 'Peak District',
    summary:
      'A classic gritstone ridge walk along Stanage Edge with huge views over the Hope Valley.',
    distanceKm: 9.5,
    ascentM: 430,
    difficulty: 'moderate',
    themes: ['ridges'],
    location: {
      lat: 53.3506,
      lon: -1.6306,
    },
    transport: {
      access_tags: ['train-accessible', 'bus-accessible', 'car-free-possible'],
    },
  },
  {
    id: 'coastal-path-sample',
    slug: 'coastal-path-sample',
    name: 'Sample Coastal Path',
    region: 'Cornwall',
    summary:
      'Undulating stretch of coastal path with cliffs, coves, and sea views.',
    distanceKm: 7.2,
    ascentM: 320,
    difficulty: 'moderate',
    themes: ['coastal'],
    location: {
      lat: 50.2001,
      lon: -5.4801,
    },
    transport: {
      access_tags: ['bus-accessible'],
    },
  },
  {
    id: 'waterfall-valley-sample',
    slug: 'waterfall-valley-sample',
    name: 'Sample Waterfall Valley Walk',
    region: 'Brecon Beacons',
    summary:
      'A woodland gorge walk visiting several scenic waterfalls and pools.',
    distanceKm: 8.4,
    ascentM: 380,
    difficulty: 'moderate',
    themes: ['waterfalls'],
    location: {
      lat: 51.8001,
      lon: -3.5501,
    },
    transport: {
      access_tags: ['car-free-possible', 'bus-accessible'],
    },
  },
  {
    id: 'lakeshore-loop-sample',
    slug: 'lakeshore-loop-sample',
    name: 'Sample Lakeshore Loop',
    region: 'Lake District',
    summary:
      'Gentle lakeshore circuit with constant water views and low-level terrain.',
    distanceKm: 5.6,
    ascentM: 150,
    difficulty: 'easy',
    themes: ['lakes'],
    location: {
      lat: 54.5501,
      lon: -3.1501,
    },
    transport: {
      access_tags: ['train-accessible'],
    },
  },
];

// Helper to look up a hike by slug
export function getHikeBySlug(slug: string): Hike | undefined {
  return hikes.find((hike) => hike.slug === slug);
}
