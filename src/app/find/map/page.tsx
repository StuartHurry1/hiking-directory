import { getAllHikes } from '@/lib/hikes';
import { FilteredHikeMapExplorer } from '@/components/FilteredHikeMapExplorer';
import { SiteHeader } from '@/components/SiteHeader';

export default async function FindMapPage() {
  const hikes = await getAllHikes();

  // Only keep hikes that have valid coordinates
  const hikesWithCoords = hikes.filter(
    (h) =>
      h.start &&
      typeof h.start.lat === 'number' &&
      typeof h.start.lon === 'number'
  );

  // Shape data for the map component
  const hikesForMap = hikesWithCoords.map((h) => ({
  slug: h.slug,
  name: h.name,
  region: h.region,
  difficulty: h.difficulty,
  distance_km: h.distance_km,
  start: {
    lat: h.start.lat,
    lon: h.start.lon,
    nearest_postcode: h.start.nearest_postcode,
  },
  transport: {
    access_tags: h.transport?.access_tags ?? [],
  },
  features: h.features ?? [],
  terrain: h.terrain ?? [],
  theme_tags: (h as any).theme_tags ?? [],
}));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Global header with nav */}
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Page header */}
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Hiking Directory
          </p>
          <h1 className="text-3xl font-semibold">Map Explorer</h1>
          <p className="text-slate-600">
            Explore all hikes on an interactive map. Use the filters to narrow
            down by difficulty, region, route length or start postcode, then
            click a hike in the list or a marker on the map to open the full
            route page.
          </p>
        </header>

        {/* Map + filters */}
        <section className="space-y-3">
          <FilteredHikeMapExplorer hikes={hikesForMap} />

          <p className="text-xs text-slate-500">
            Tip: scroll to zoom, drag to pan, click a marker for details, or
            pick a hike from the list to focus it on the map.
          </p>
        </section>
      </main>
    </div>
  );
}
