import { Metadata } from 'next';
import { HikeListCard } from '@/components/HikeListCard';
import { FilteredHikeMapExplorer } from '@/components/FilteredHikeMapExplorer';

export const metadata: Metadata = {
  title: 'Find hikes | UK Hiking Directory',
  description: 'Search UK hiking trails by distance, difficulty, theme, and transport options.',
};

const mockHikes = [
  {
    slug: 'stanage-edge-ridge-walk',
    name: 'Stanage Edge Ridge Walk',
    region: 'Peak District, England',
    distanceKm: 9.6,
    ascentM: 380,
    difficulty: 'moderate' as const,
    themeTags: ['ridges'],
    transportTags: ['train-accessible', 'car-free-possible'],
    thumbnailUrl:
      'https://images.pexels.com/photos/5726882/pexels-photo-5726882.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    slug: 'buttermere-lakeside-circuit',
    name: 'Buttermere Lakeside Circuit',
    region: 'Lake District, England',
    distanceKm: 7.8,
    ascentM: 220,
    difficulty: 'easy' as const,
    themeTags: ['lakes'],
    transportTags: ['bus-accessible'],
    thumbnailUrl:
      'https://images.pexels.com/photos/46253/pexels-photo-46253.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
];

export default function FindPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Page header */}
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Find UK hiking trails
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Filter by difficulty, distance, theme, and public transport —
            discover routes you can reach by train or bus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500 sm:text-sm">
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">
            🚆 Train accessible
          </span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">
            🚌 Bus accessible
          </span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">
            🚶 Car-free possible
          </span>
        </div>
      </header>

      {/* Main layout: list + map (AllTrails style) */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        {/* Left column: filters + list */}
        <section className="flex flex-col gap-3">
          {/* Filters row (you can wire real filters later) */}
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm">
              Difficulty
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm">
              Distance
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm">
              Themes
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm">
              Transport
            </button>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-xs text-slate-500 sm:text-sm">
            <span>
              Showing <span className="font-semibold">{mockHikes.length}</span>{' '}
              hikes
            </span>
            <button className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline">
              Sort by: Featured
            </button>
          </div>

          {/* Hike list */}
          <div className="flex flex-col gap-3">
            {mockHikes.map((hike) => (
              <HikeListCard key={hike.slug} {...hike} />
            ))}
          </div>
        </section>

        {/* Right column: map */}
        <aside className="h-80 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:h-[550px]">
          {/* On mobile, we show a label above the map */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 sm:px-4">
            <span>Map view</span>
            <span className="text-[11px] text-slate-400">
              Pan & zoom to refine results
            </span>
          </div>

          {/* If you have FilteredHikeMapExplorer: */}
          <FilteredHikeMapExplorer />

          {/* If not yet implemented, temporarily: 
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Map coming soon
          </div>
          */}
        </aside>
      </div>
    </div>
  );
}
