'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvent,
} from 'react-leaflet';
import L from 'leaflet';

import { hikes, type Hike } from '@/data/hikes';

// If you had a fixLeaflet() helper before, you can re-add it like this:
// import { fixLeaflet } from '@/lib/leaflet-ssr';
// useEffect(() => { fixLeaflet(); }, []);

type TransportFilterState = {
  trainOnly: boolean;
  busOnly: boolean;
  carFreeOnly: boolean;
};

type ThemeFilterState = {
  coastal: boolean;
  waterfalls: boolean;
  lakes: boolean;
  ridges: boolean;
};

const defaultTransportFilter: TransportFilterState = {
  trainOnly: false,
  busOnly: false,
  carFreeOnly: false,
};

const defaultThemeFilter: ThemeFilterState = {
  coastal: false,
  waterfalls: false,
  lakes: false,
  ridges: false,
};

function matchesCarFreeFilters(hike: Hike, options: TransportFilterState) {
  const tags = hike.transport?.access_tags ?? [];

  if (options.trainOnly && !tags.includes('train-accessible')) return false;
  if (options.busOnly && !tags.includes('bus-accessible')) return false;
  if (options.carFreeOnly && !tags.includes('car-free-possible')) return false;

  return true;
}

function matchesThemeFilters(hike: Hike, themes: ThemeFilterState) {
  const activeThemes = Object.entries(themes)
    .filter(([, value]) => value)
    .map(([key]) => key) as Hike['themes'][number][];

  if (activeThemes.length === 0) return true;

  // At least one of the hike's themes must match an active theme
  return hike.themes.some((t) => activeThemes.includes(t));
}

function matchesSearch(hike: Hike, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    hike.name.toLowerCase().includes(q) ||
    hike.region.toLowerCase().includes(q) ||
    hike.summary.toLowerCase().includes(q)
  );
}

// Basic Leaflet marker icon (assumes leaflet CSS is loaded globally)
const defaultIcon = L.icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
});

type MapSyncProps = {
  selectedHike?: Hike | null;
};

function MapSync({ selectedHike }: MapSyncProps) {
  const map = useMapEvent('click', () => {
    // no-op, just to get map instance
  });

  useEffect(() => {
    if (!selectedHike) return;
    map.flyTo(
      [selectedHike.location.lat, selectedHike.location.lon],
      11,
      { duration: 0.7 },
    );
  }, [selectedHike, map]);

  return null;
}

export function FilteredHikeMapExplorer() {
  const [transportFilter, setTransportFilter] = useState<TransportFilterState>(
    defaultTransportFilter,
  );
  const [themeFilter, setThemeFilter] = useState<ThemeFilterState>(
    defaultThemeFilter,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHikeId, setSelectedHikeId] = useState<string | null>(null);

  // For scrolling the selected card into view
  const listRef = useRef<HTMLDivElement | null>(null);

  const filteredHikes = useMemo(() => {
    return hikes.filter(
      (hike) =>
        matchesCarFreeFilters(hike, transportFilter) &&
        matchesThemeFilters(hike, themeFilter) &&
        matchesSearch(hike, searchQuery),
    );
  }, [transportFilter, themeFilter, searchQuery]);

  const selectedHike =
    filteredHikes.find((h) => h.id === selectedHikeId) ?? null;

  // Auto-select first hike when filters/search change (if none selected)
  useEffect(() => {
    if (filteredHikes.length === 0) {
      setSelectedHikeId(null);
      return;
    }
    if (!selectedHikeId || !filteredHikes.some((h) => h.id === selectedHikeId)) {
      setSelectedHikeId(filteredHikes[0].id);
    }
  }, [filteredHikes, selectedHikeId]);

  // Scroll selected card into view
  useEffect(() => {
    if (!listRef.current || !selectedHikeId) return;
    const el = listRef.current.querySelector<HTMLDivElement>(
      `[data-hike-id="${selectedHikeId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedHikeId]);

  // Compute a rough centre of all hikes (fallback to UK centre)
  const mapCenter = useMemo(() => {
    if (!hikes.length) return [54.5, -3.0] as [number, number];

    const latSum = hikes.reduce((sum, h) => sum + h.location.lat, 0);
    const lonSum = hikes.reduce((sum, h) => sum + h.location.lon, 0);
    return [latSum / hikes.length, lonSum / hikes.length] as [number, number];
  }, []);

  const handleTransportToggle = (key: keyof TransportFilterState) => {
    setTransportFilter((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleThemeToggle = (key: keyof ThemeFilterState) => {
    setThemeFilter((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCardClick = (hike: Hike) => {
    setSelectedHikeId(hike.id);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4 lg:flex-row">
      {/* Left: Filters + list */}
      <div className="flex w-full flex-col gap-3 lg:w-5/12">
        {/* Filters */}
        <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                Search
              </label>
              <input
                type="text"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Search by name, area, or keywords…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Themes */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                Themes
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ['coastal', 'Coastal'],
                  ['waterfalls', 'Waterfalls'],
                  ['lakes', 'Lakes'],
                  ['ridges', 'Ridges'],
                ] as const).map(([key, label]) => {
                  const active = themeFilter[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleThemeToggle(key)}
                      className={
                        'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                        (active
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transport */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                Car-free access
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTransportToggle('trainOnly')}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                    (transportFilter.trainOnly
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                  }
                >
                  Train accessible
                </button>
                <button
                  type="button"
                  onClick={() => handleTransportToggle('busOnly')}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                    (transportFilter.busOnly
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                  }
                >
                  Bus accessible
                </button>
                <button
                  type="button"
                  onClick={() => handleTransportToggle('carFreeOnly')}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                    (transportFilter.carFreeOnly
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                  }
                >
                  Car-free possible
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto rounded-xl border bg-white/80 p-3 shadow-sm"
        >
          {filteredHikes.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No hikes match these filters yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredHikes.map((hike) => {
                const isSelected = hike.id === selectedHikeId;
                const accessTags = hike.transport?.access_tags ?? [];

                return (
                  <div
                    key={hike.id}
                    data-hike-id={hike.id}
                    onClick={() => handleCardClick(hike)}
                    className={
                      'cursor-pointer rounded-xl border px-3 py-3 text-sm transition hover:shadow-sm ' +
                      (isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 bg-white')
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {hike.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {hike.region}
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <div>{hike.distanceKm.toFixed(1)} km</div>
                        <div>{hike.ascentM} m ascent</div>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                      {hike.summary}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {hike.themes.map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                        >
                          {theme}
                        </span>
                      ))}
                      {accessTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/hike/${hike.slug}`}
                        className="text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:no-underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Map */}
      <div className="h-80 w-full overflow-hidden rounded-xl border shadow-sm lg:h-full lg:w-7/12">
        <MapContainer
          center={mapCenter}
          zoom={6}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapSync selectedHike={selectedHike ?? undefined} />

          {filteredHikes.map((hike) => {
            const isSelected = hike.id === selectedHikeId;
            return (
              <Marker
                key={hike.id}
                position={[hike.location.lat, hike.location.lon]}
                icon={isSelected ? selectedIcon : defaultIcon}
                eventHandlers={{
                  click: () => setSelectedHikeId(hike.id),
                }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold">{hike.name}</div>
                    <div className="text-gray-500">{hike.region}</div>
                    <div>
                      {hike.distanceKm.toFixed(1)} km · {hike.ascentM} m
                    </div>
                    <Link
                      href={`/hike/${hike.slug}`}
                      className="text-emerald-700 underline underline-offset-2"
                    >
                      View details →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default FilteredHikeMapExplorer;
