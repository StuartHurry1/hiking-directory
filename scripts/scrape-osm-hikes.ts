// scripts/scrape-osm-hikes.ts
import fs from 'node:fs';
import path from 'node:path';
import slugify from 'slugify';
import { RawOsmHike } from './hike-types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Very simple UK-wide query; you can refine later to regions
const OVERPASS_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="GB"][admin_level=2]->.uk;
(
  relation["route"="hiking"](area.uk);
  relation["route"="foot"](area.uk);
);
out body;
>;
out skel qt;
`;

// Optional: limit how many relations you process (for debugging).
// Example: MAX_OSM_RELATIONS=200 pnpm tsx scripts/scrape-osm-hikes.ts
const MAX_RELATIONS =
  process.env.MAX_OSM_RELATIONS && !Number.isNaN(Number(process.env.MAX_OSM_RELATIONS))
    ? Number(process.env.MAX_OSM_RELATIONS)
    : undefined;

// Optional: skip files that already exist instead of overwriting.
// Example: OSM_SKIP_EXISTING=true pnpm tsx scripts/scrape-osm-hikes.ts
const SKIP_EXISTING = process.env.OSM_SKIP_EXISTING === 'true';

type OsmNode = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OsmWay = {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};

type OsmRelationMember = {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role?: string;
};

type OsmRelation = {
  type: 'relation';
  id: number;
  tags?: Record<string, string>;
  members?: OsmRelationMember[];
};

type OsmElement = OsmNode | OsmWay | OsmRelation;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toSlug(name: string, id: number): string {
  const base = slugify(name, {
    lower: true,
    strict: true,
  });
  return base ? `${base}-${id}` : `osm-hike-${id}`;
}

async function fetchOsm(): Promise<{ elements: OsmElement[] }> {
  console.log('Calling Overpass API…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: OVERPASS_QUERY,
    headers: {
      'Content-Type': 'text/plain',
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Overpass error ${res.status}: ${txt}`);
  }

  const json = (await res.json()) as { elements: OsmElement[] };
  return json;
}

/**
 * Pre-index nodes and ways for O(1) lookups instead of scanning the array
 * on every relation.
 */
function buildIndexes(elements: OsmElement[]) {
  const nodesById = new Map<number, OsmNode>();
  const waysById = new Map<number, OsmWay>();
  const relations: OsmRelation[] = [];

  for (const el of elements) {
    if (el.type === 'node') {
      nodesById.set(el.id, el as OsmNode);
    } else if (el.type === 'way') {
      waysById.set(el.id, el as OsmWay);
    } else if (el.type === 'relation') {
      relations.push(el as OsmRelation);
    }
  }

  console.log(
    `Indexed ${nodesById.size} nodes, ${waysById.size} ways, ${relations.length} relations`
  );

  return { nodesById, waysById, relations };
}

/**
 * Build coordinate list [lon, lat] for a single relation using pre-built
 * node/way maps. This is MUCH faster than re-scanning elements every time.
 */
function getRelationCoords(
  relation: OsmRelation,
  waysById: Map<number, OsmWay>,
  nodesById: Map<number, OsmNode>
): [number, number][] {
  const members = relation.members ?? [];
  const coords: [number, number][] = [];

  for (const member of members) {
    if (member.type !== 'way') continue;

    const way = waysById.get(member.ref);
    if (!way || !Array.isArray(way.nodes)) continue;

    for (const nodeId of way.nodes) {
      const node = nodesById.get(nodeId);
      if (!node) continue;
      coords.push([node.lon, node.lat]);
    }
  }

  // Optionally, you could de-duplicate consecutive identical points here.
  return coords;
}

async function main() {
  const rawDir = path.join(process.cwd(), 'data', 'raw', 'osm');
  ensureDir(rawDir);

  console.log('Fetching OSM hiking routes for UK…');
  const osmJson = await fetchOsm();

  const { nodesById, waysById, relations } = buildIndexes(osmJson.elements);

  const totalRelations = MAX_RELATIONS
    ? Math.min(relations.length, MAX_RELATIONS)
    : relations.length;

  console.log(
    `Processing ${totalRelations} route relations` +
      (MAX_RELATIONS ? ` (limited by MAX_OSM_RELATIONS=${MAX_RELATIONS})` : '')
  );

  let savedCount = 0;
  let skippedNoName = 0;
  let skippedNoCoords = 0;
  let skippedExisting = 0;

  for (let i = 0; i < totalRelations; i++) {
    const rel = relations[i];

    const name = rel.tags?.name as string | undefined;
    if (!name) {
      skippedNoName++;
      continue; // skip nameless routes
    }

    const id = rel.id;
    const slug = toSlug(name, id);
    const file = path.join(rawDir, `${slug}.json`);

    if (SKIP_EXISTING && fs.existsSync(file)) {
      skippedExisting++;
      continue;
    }

    const coords = getRelationCoords(rel, waysById, nodesById);
    if (coords.length < 2) {
      skippedNoCoords++;
      continue;
    }

    const raw: RawOsmHike = {
      id,
      slug,
      name,
      network: rel.tags?.network,
      tags: rel.tags ?? {},
      coordinates: coords,
    };

    // Synchronous is simple and safe; if this becomes a bottleneck later
    // we can switch to async writes with a concurrency limit.
    fs.writeFileSync(file, JSON.stringify(raw, null, 2), 'utf8');
    savedCount++;

    // Progress log every 100 saved hikes (not every relation)
    if (savedCount % 100 === 0) {
      const percent = ((i + 1) / totalRelations) * 100;
      console.log(
        `Saved ${savedCount} hikes so far (${(percent).toFixed(
          1
        )}% of relations processed)`
      );
    }
  }

  console.log('--------------------------------------------');
  console.log(`Finished processing ${totalRelations} relations.`);
  console.log(`Saved hikes          : ${savedCount}`);
  console.log(`Skipped (no name)    : ${skippedNoName}`);
  console.log(`Skipped (no coords)  : ${skippedNoCoords}`);
  if (SKIP_EXISTING) {
    console.log(`Skipped (existing)   : ${skippedExisting}`);
  }
  console.log(`Output directory     : ${rawDir}`);
  console.log('--------------------------------------------');
}

main().catch((err) => {
  console.error('scrape-osm-hikes.ts failed:', err);
  process.exit(1);
});
