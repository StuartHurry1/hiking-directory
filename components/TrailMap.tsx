'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type TrailMapProps = {
  center: { lat: number; lon: number };
  gpxUrl?: string;          // if set → draw line
  height?: string;
  zoom?: number;
};

const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

export function TrailMap({
  center,
  gpxUrl,
  height = '260px',
  zoom = 12,
}: TrailMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [center.lon, center.lat],
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', async () => {
      // Always show a start marker
      new maplibregl.Marker({ color: '#2563eb' })
        .setLngLat([center.lon, center.lat])
        .addTo(map);

      // If no GPX, we stop here (mini-map mode on /find)
      if (!gpxUrl) return;

      try {
        const res = await fetch(gpxUrl);
        const text = await res.text();

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');

        // Grab all <trkpt> points from the GPX file
        const trkpts = Array.from(xml.getElementsByTagName('trkpt'));
        const coords = trkpts
          .map((pt) => {
            const lat = parseFloat(pt.getAttribute('lat') || '0');
            const lon = parseFloat(pt.getAttribute('lon') || '0');
            if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
            return [lon, lat] as [number, number];
          })
          .filter((c): c is [number, number] => !!c);

        if (coords.length < 2) return; // not enough points for a line

        const sourceId = 'trail-' + Math.random().toString(36).slice(2);

        // Add GPX line as GeoJSON source
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
          },
        });

        map.addLayer({
          id: sourceId + '-line',
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#2563eb', // blue line
            'line-width': 4,
          },
        });

        // Fit map to the full route
        const bounds = coords.reduce(
          (b, coord) => b.extend(coord),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: 40, duration: 800 });
      } catch (err) {
        console.error('Failed to load GPX for map:', gpxUrl, err);
      }
    });

    return () => {
      map.remove();
    };
  }, [center.lat, center.lon, gpxUrl, zoom]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
