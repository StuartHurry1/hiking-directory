import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TrailMap } from '@/components/TrailMap';
import { getHikeBySlug, getNearbyHikes } from '@/lib/hikes';

type PageProps = {
  params: Promise<{ slug?: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function HikePage({ params, searchParams }: PageProps) {
  // 🔹 Next.js 16: these are Promises now, so we must await them
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // ---- Robust slug extraction (string or string[]) ----
  const rawSlug = resolvedSearchParams.slug ?? resolvedParams.slug;
  const slug =
    Array.isArray(rawSlug) ? (rawSlug[0] as string) : (rawSlug as string | undefined);

  // 🔹 Debug page if slug is missing
  if (!slug) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <h1 className="text-3xl font-bold mb-2">No hike selected</h1>
        <p className="mb-2">
          This page expects a hike <code>slug</code> in the URL, for example:
        </p>
        <pre className="bg-slate-100 p-3 rounded text-sm">
          /hike?slug=stanage-edge-ridge-walk
        </pre>

        <p className="mt-4">
          <strong>Debug info (resolved values from Next.js):</strong>
        </p>
        <pre className="bg-slate-100 p-3 rounded text-xs whitespace-pre-wrap">
{JSON.stringify(
  {
    params: resolvedParams,
    searchParams: resolvedSearchParams,
  },
  null,
  2
)}
        </pre>

        <p className="mt-4">
          Go back to{' '}
          <Link href="/find" className="text-blue-600 underline">
            the hike search page
          </Link>{' '}
          and click &ldquo;View full route&rdquo; on a hike.
        </p>
      </main>
    );
  }

  // ---- We have a slug: load hike data ----
  const hike = await getHikeBySlug(slug);
  if (!hike) {
    notFound();
  }

  const nearby = await getNearbyHikes(slug, 30, 4);

  const {
    name,
    region,
    county,
    difficulty,
    distance_km,
    ascent_m,
    time_hours,
    summary,
    terrain,
    terrain_summary,
    safety_notes,
    start,
    gpx_file,
  } = hike;

  const badgeText = difficulty?.toUpperCase() || 'ROUTE';

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          HIKING ROUTE
        </p>
        <h1 className="text-3xl font-semibold">{name}</h1>
        <p className="text-sm text-slate-600">
          {[region, county].filter(Boolean).join(', ')}
        </p>

        <div className="flex flex-wrap gap-3 text-sm text-slate-800 mt-2">
          <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-semibold">
            {badgeText}
          </span>
          {typeof distance_km === 'number' && (
            <span>
              <strong>Distance:</strong> {distance_km.toFixed(1)} km
            </span>
          )}
          {typeof ascent_m === 'number' && (
            <span>
              <strong>Ascent:</strong> {ascent_m} m
            </span>
          )}
          {typeof time_hours === 'number' && (
            <span>
              <strong>Time:</strong> {time_hours} hours
            </span>
          )}
          {start?.nearest_postcode && (
            <span>
              <strong>Nearest postcode:</strong> {start.nearest_postcode}
            </span>
          )}
        </div>
      </header>

      {/* Map */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Route map</h2>
        <p className="text-sm text-slate-600">
          Pan and zoom to explore the route. The blue line shows the GPX track
          and the marker shows the starting point.
        </p>
        <TrailMap
          center={{ lat: start.lat, lon: start.lon }}
          gpxUrl={gpx_file}
          height="480px"
        />
      </section>

      {/* Overview & terrain */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Route overview</h2>
          {summary ? (
            <p className="text-slate-700 whitespace-pre-line">{summary}</p>
          ) : (
            <p className="text-slate-700">
              This section can contain an AI-generated summary describing the
              character of the route, highlights, and general feel of the walk.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Terrain</h3>
          {terrain_summary || terrain ? (
            <p className="text-slate-700">
              {terrain_summary || terrain}
            </p>
          ) : (
            <p className="text-slate-700">
              Terrain details can go here (e.g. moorland tracks, rocky edges,
              occasional boggy sections).
            </p>
          )}

          {safety_notes && safety_notes.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-800">
                Safety notes
              </h4>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                {safety_notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Start location */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Start location</h2>
        <p className="text-sm text-slate-700">
          <strong>Coordinates:</strong>{' '}
          <span className="font-mono">
            {start.lat.toFixed(5)}, {start.lon.toFixed(5)}
          </span>
        </p>
        {start.nearest_postcode && (
          <p className="text-sm text-slate-700">
            <strong>Nearest postcode:</strong> {start.nearest_postcode}
          </p>
        )}
        {start.car_park_name && (
          <p className="text-sm text-slate-700">
            <strong>Car park:</strong> {start.car_park_name}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Coordinates and details are provided as a planning aid only. Always
          check local conditions and use appropriate navigation tools on the
          day.
        </p>
      </section>

      {/* GPX download */}
      {gpx_file && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">GPX file</h2>
          <p className="text-sm text-slate-700">
            You can download the GPX file for use with your GPS device or
            mapping app.
          </p>
          <a
            href={gpx_file}
            download
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 underline"
          >
            Download GPX
          </a>
        </section>
      )}

      {/* Nearby hikes */}
      {nearby.length > 0 && (
        <section className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-xl font-semibold">Nearby hikes</h2>
          <p className="text-sm text-slate-600">
            Other routes within about 30 km of this start point.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {nearby.map((h) => (
              <a
                key={h.slug}
                href={`/hike?slug=${h.slug}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {h.region || 'Hiking route'}
                </p>
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-slate-600">
                  {h.difficulty && (
                    <span className="font-semibold">
                      {h.difficulty.toUpperCase()}
                    </span>
                  )}
                  {typeof h.distance_km === 'number' && (
                    <> · {h.distance_km.toFixed(1)} km</>
                  )}
                  {' · '}
                  {h.distance_from_start_km.toFixed(1)} km away
                </p>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
