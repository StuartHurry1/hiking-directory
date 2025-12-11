import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getHikeBySlug, hikes, type Hike } from '@/data/hikes';

type PageProps = {
  params: { slug: string };
};

// Pre-generate a page for every hike
export function generateStaticParams() {
  return hikes.map((hike) => ({ slug: hike.slug }));
}

const difficultyConfig: Record<
  Hike['difficulty'],
  { label: string; badgeClass: string }
> = {
  easy: {
    label: 'Easy',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-100',
  },
  moderate: {
    label: 'Moderate',
    badgeClass:
      'bg-amber-50 text-amber-700 border border-amber-100',
  },
  challenging: {
    label: 'Challenging',
    badgeClass:
      'bg-rose-50 text-rose-700 border border-rose-100',
  },
};

const transportLabels: Record<string, string> = {
  'train-accessible': 'Train accessible',
  'bus-accessible': 'Bus accessible',
  'car-free-possible': 'Car-free possible',
};

export default function HikeDetailPage({ params }: PageProps) {
  const hike = getHikeBySlug(params.slug);

  if (!hike) {
    return notFound();
  }

  const difficulty = difficultyConfig[hike.difficulty];
  const accessTags = hike.transport?.access_tags ?? [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link
          href="/find"
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
        >
          <span aria-hidden>←</span>
          <span>Back to map & list</span>
        </Link>
      </div>

      {/* Title + basic meta */}
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {hike.name}
        </h1>
        <p className="text-gray-600">{hike.region}</p>
        <p className="max-w-2xl text-gray-700">{hike.summary}</p>
      </header>

      {/* Key stats + View full route button */}
      <section className="grid gap-4 rounded-2xl border bg-white/80 p-5 shadow-sm sm:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Distance */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Distance
            </div>
            <div className="mt-1 text-xl font-semibold">
              {hike.distanceKm.toFixed(1)} km
            </div>
          </div>

          {/* Ascent */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ascent
            </div>
            <div className="mt-1 text-xl font-semibold">
              {hike.ascentM} m
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Difficulty
            </div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${difficulty?.badgeClass ?? 'bg-gray-100 text-gray-700'}`}
              >
                {difficulty?.label ?? hike.difficulty}
              </span>
            </div>
          </div>
        </div>

        {/* View full route button */}
        <div className="flex items-center justify-start sm:justify-end">
          <a
            href="#route-map"
            className="inline-flex items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:border-emerald-700"
          >
            View full route
            <span aria-hidden className="ml-1">
              →
            </span>
          </a>
        </div>
      </section>

      {/* Themes & transport badges */}
      <section className="flex flex-wrap items-start gap-6">
        {/* Themes */}
        {hike.themes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Themes
            </div>
            <div className="flex flex-wrap gap-2">
              {hike.themes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Transport */}
        {accessTags.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Car-free access
            </div>
            <div className="flex flex-wrap gap-2">
              {accessTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  {transportLabels[tag] ?? tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Route overview text */}
      <section className="rounded-2xl border bg-white/80 p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Route overview</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          This page currently shows an overview of the hike using your core
          stats and tags. In the next step, this description can be expanded
          with turn-by-turn notes, highlights, safety information, and
          transport tips so walkers know exactly what to expect.
        </p>
      </section>

      {/* Map / full route section (for Step 3 GPX integration) */}
      <section
        id="route-map"
        className="rounded-2xl border border-dashed bg-gray-50/70 p-6 text-sm text-gray-700"
      >
        <h2 className="mb-3 text-lg font-semibold">Route map</h2>
        <p className="mb-2">
          This is where the interactive map and full GPX route will live.
          You’ll be able to:
        </p>
        <ul className="mb-3 list-disc pl-5 text-sm">
          <li>Show the full route as a line on the map</li>
          <li>Zoom to the trail when “View full route →” is clicked</li>
          <li>Highlight start / finish points and key waymarks</li>
        </ul>
        <p className="text-xs text-gray-500">
          We’ll wire this up in Step 3 using your GPX files and a Leaflet /
          MapLibre map component.
        </p>
      </section>
    </main>
  );
}
