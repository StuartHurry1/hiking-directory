// scripts/hike-types.ts

export type Difficulty = 'easy' | 'moderate' | 'hard';

export type ThemeTag = 'coastal' | 'waterfalls' | 'lakes' | 'ridges';
export type TransportTag =
  | 'train-accessible'
  | 'bus-accessible'
  | 'car-free-possible';

export interface RawOsmHike {
  id: number; // OSM relation id
  slug: string;
  name: string;
  network?: string;
  tags: Record<string, string>;
  coordinates: [number, number][]; // [lon, lat] sequence
}

export interface Hike {
  id: string; // e.g. "osm-123456"
  slug: string;
  name: string;
  region: string;
  country: 'England' | 'Wales' | 'Scotland' | 'Northern Ireland' | 'UK';

  distanceKm: number;
  ascentM?: number;

  difficulty: Difficulty;

  themes: ThemeTag[];
  transport: {
    access_tags: TransportTag[];
  };

  start: {
    lat: number;
    lon: number;
  };

  source: {
    type: 'osm';
    osmId: number;
  };

  ai?: {
    summary: string;
    terrain_summary: string;
    safety_notes: string;
    recommended_gear: string[];
    best_seasons: string;
    seo: {
      title: string;
      meta_description: string;
      h1: string;
    };
  };
}
