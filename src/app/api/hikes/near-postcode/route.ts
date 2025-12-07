import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

type PostcodeRecord = {
  postcode: string
  area: string
  district: string
  sector: string
  latitude: number
  longitude: number
  easting?: number
  northing?: number
  district_code?: string
  ward_code?: string
  in_use?: boolean
}

// 🔹 Hike type now includes extra optional fields
type Hike = {
  id: string
  slug: string
  name: string
  region: string
  distance_km: number
  difficulty: string
  start: {
    lat: number
    lon: number
    nearest_postcode?: string
  }
  summary?: string
  terrain?: string
  estimated_time_hours?: number
  ascent_meters?: number
  gpx_path?: string
}

// 🔹 The API result is just Hike + distanceFromPostcodeKm
type HikeWithDistance = Hike & {
  distanceFromPostcodeKm: number
}

function normalisePostcode(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  const singleSpaced = trimmed.replace(/\s+/g, ' ')
  if (singleSpaced.includes(' ')) return singleSpaced
  if (singleSpaced.length > 3) {
    const prefix = singleSpaced.slice(0, -3)
    const suffix = singleSpaced.slice(-3)
    return `${prefix} ${suffix}`
  }
  return singleSpaced
}

function postcodeToFilename(postcode: string): string {
  const noSpace = postcode.replace(/\s+/, '-')
  return `${noSpace}.json`
}

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function loadPostcodeRecord(postcode: string): Promise<PostcodeRecord | null> {
  try {
    const baseDir = path.join(process.cwd(), 'data', 'postcodes', 'by-code')
    const filename = postcodeToFilename(postcode)
    const fullPath = path.join(baseDir, filename)
    const file = await fs.readFile(fullPath, 'utf8')
    const json = JSON.parse(file) as PostcodeRecord
    if (json.in_use === false) return null
    return json
  } catch (err) {
    console.error('loadPostcodeRecord error:', err)
    return null
  }
}

async function loadAllHikes(): Promise<Hike[]> {
  const hikesDir = path.join(process.cwd(), 'data', 'hikes')
  let files: string[]
  try {
    files = await fs.readdir(hikesDir)
  } catch (err) {
    console.error('Could not read hikes directory:', err)
    return []
  }

  const hikes: Hike[] = []
  for (const fileName of files) {
    if (!fileName.endsWith('.json')) continue
    const fullPath = path.join(hikesDir, fileName)
    try {
      const jsonStr = await fs.readFile(fullPath, 'utf8')
      const hike = JSON.parse(jsonStr) as Hike
      if (
        typeof hike.start?.lat === 'number' &&
        typeof hike.start?.lon === 'number'
      ) {
        hikes.push(hike)
      }
    } catch (err) {
      console.error(`Error reading hike file ${fileName}:`, err)
    }
  }
  return hikes
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const searchParams = url.searchParams

  const rawPostcode = searchParams.get('postcode')
  const rawDistance = searchParams.get('distance') ?? '50'
  const rawLimit = searchParams.get('limit') ?? '20'

  if (!rawPostcode) {
    return NextResponse.json(
      { error: 'Missing required query parameter: postcode' },
      { status: 400 }
    )
  }

  const postcode = normalisePostcode(rawPostcode)
  const maxDistanceKm = Number(rawDistance)
  const limit = Number(rawLimit)

  if (Number.isNaN(maxDistanceKm) || maxDistanceKm <= 0) {
    return NextResponse.json(
      { error: 'distance must be a positive number (km)' },
      { status: 400 }
    )
  }

  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json(
      { error: 'limit must be a positive number' },
      { status: 400 }
    )
  }

  const postcodeRecord = await loadPostcodeRecord(postcode)
  if (!postcodeRecord) {
    return NextResponse.json(
      { error: `Postcode not found or not in use: ${postcode}` },
      { status: 404 }
    )
  }

  const hikes = await loadAllHikes()
  if (hikes.length === 0) {
    return NextResponse.json(
      { error: 'No hikes data available yet' },
      { status: 500 }
    )
  }

  const results: HikeWithDistance[] = hikes
    .map((hike) => {
      const distanceFromPostcodeKm = haversineDistanceKm(
        postcodeRecord.latitude,
        postcodeRecord.longitude,
        hike.start.lat,
        hike.start.lon
      )

      // 🔹 Spread the whole hike (including summary, terrain, etc.)
      // and just add distanceFromPostcodeKm
      return {
        ...hike,
        distanceFromPostcodeKm: Number(distanceFromPostcodeKm.toFixed(2)),
      }
    })
    .filter((h) => h.distanceFromPostcodeKm <= maxDistanceKm)
    .sort((a, b) => a.distanceFromPostcodeKm - b.distanceFromPostcodeKm)
    .slice(0, limit)

  return NextResponse.json({
    postcode: postcodeRecord.postcode,
    normalisedPostcode: postcode,
    maxDistanceKm,
    limit,
    resultCount: results.length,
    results,
  })
}
