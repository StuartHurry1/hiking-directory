'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type HikeForMap = {
  slug: string;
  name: string;
  region?: string;
  start: { lat: number; lon: number; nearest_postcode?: string };
};

type HikeMapExplorerProps = {
  hikes: HikeForMap[];
  height?: string;
  selectedSlug?: string | null;
};

export function HikeMapExplorer({
  hikes,
  height = '600px',
  selectedSlug = null,
}: HikeMapExplorerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const sourceId = 'hikes';

  // 1) Initialise map (once)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const initialCenter: [number, number] = [-1.5, 54.5]; // Rough UK centre

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: initialCenter,
      zoom: 6,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      const geojson = hikesToGeoJSON(hikes);

      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      });

      // Cluster circles
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#2563eb',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14,
            10,
            18,
            50,
            24,
          ],
          'circle-opacity': 0.85,
        },
      });

      // Cluster counts
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Individual points
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#2563eb',
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Zoom into cluster on click
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        });
        const feature = features[0];
        if (!feature || !feature.properties) return;

        const clusterId = feature.properties.cluster_id as number;
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const coords = (feature.geometry as any).coordinates as [
            number,
            number,
          ];
          map.easeTo({ center: coords, zoom });
        });
      });

      // Open popup on unclustered point click
      map.on('click', 'unclustered-point', (e) => {
        const f = e.features?.[0];
        if (!f || !f.properties) return;
        const coords = (f.geometry as any).coordinates as [number, number];
        const { slug, name, region } = f.properties as any;

        new maplibregl.Popup({ offset: 16 })
          .setLngLat(coords)
          .setHTML(popupHtml(slug, name, region))
          .addTo(map);
      });

      // Zoom cursor
      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
      });

      // Initial fit to all hikes
      fitMapToHikes(map, hikes);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Update data when hikes change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | null;
    if (!source) return;

    const geojson = hikesToGeoJSON(hikes);
    source.setData(geojson);

    fitMapToHikes(map, hikes);
  }, [hikes]);

  // 3) Fly to selected hike when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSlug) return;

    const selected = hikes.find((h) => h.slug === selectedSlug);
    if (!selected) return;

    const { lat, lon } = selected.start;

    map.easeTo({
      center: [lon, lat],
      zoom: 12,
    });

    new maplibregl.Popup({ offset: 16 })
      .setLngLat([lon, lat])
      .setHTML(
        popupHtml(selected.slug, selected.name, selected.region ?? undefined)
      )
      .addTo(map);
  }, [selectedSlug, hikes]);

  if (hikes.length === 0) {
    return (
      <div className="w-full border border-slate-200 rounded-xl p-4 text-slate-600">
        No hikes found yet.
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm"
      style={{ height }}
    >
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

function hikesToGeoJSON(hikes: HikeForMap[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hikes.map((h) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [h.start.lon, h.start.lat],
      },
      properties: {
        slug: h.slug,
        name: h.name,
        region: h.region ?? '',
      },
    })),
  };
}

function fitMapToHikes(map: MapLibreMap, hikes: HikeForMap[]) {
  if (hikes.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  hikes.forEach((h) => {
    bounds.extend([h.start.lon, h.start.lat]);
  });
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 60, maxZoom: 11 });
  }
}

function popupHtml(slug: string, name: string, region?: string) {
  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px;">
      <strong>${name}</strong><br/>
      ${region ? `<span>${region}</span><br/>` : ''}
      <a href="/hike/${slug}" style="color:#2563eb; text-decoration:underline;">
        View route →
      </a>
    </div>
  `;
}
