import { TrailMap } from '@/components/TrailMap';

export default function MapTestPage() {
  // Rough center near our sample GPX points
  const center = { lat: 54.455, lon: -3.215 };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold mb-2">
        MapLibre GPX Test – Sample Trail
      </h1>
      <p className="text-slate-600">
        If everything is set up correctly, you should see a base map with a
        blue trail line and a marker at the start.
      </p>

      <TrailMap
        center={center}
        gpxUrl="/gpx/sample-trail.gpx"
        height="500px"
        zoom={13}
      />
    </main>
  );
}
