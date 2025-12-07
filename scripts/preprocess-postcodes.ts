// scripts/preprocess-postcodes.ts

import fs from 'fs'
import path from 'path'
import readline from 'readline'

type RawRow = string[]

type HeaderMap = Record<string, number>

type PostcodeRecord = {
  postcode: string
  area: string
  district: string
  sector: string
  latitude: number
  longitude: number
  easting?: number | null
  northing?: number | null
  gridref?: string | null
  district_code?: string | null
  ward_code?: string | null
  lsoa_code?: string | null
  msoa_code?: string | null
  itl_level_2?: string | null
  itl_level_3?: string | null
  country?: string | null
  in_use: boolean
}

type DistrictIndexItem = {
  postcode: string
  latitude: number
  longitude: number
}

const ROOT = process.cwd()
const CSV_PATH = path.join(ROOT, 'data', 'uk_postcodes.csv')
const OUT_BY_CODE = path.join(ROOT, 'data', 'postcodes', 'by-code')
const OUT_BY_DISTRICT = path.join(ROOT, 'data', 'postcodes', 'by-district')

// ---------- helpers ----------

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true })
  }
}

function normalisePostcode(raw: string): string {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!trimmed) return ''

  if (trimmed.length <= 3) return trimmed

  const outward = trimmed.slice(0, trimmed.length - 3)
  const inward = trimmed.slice(-3)
  return `${outward} ${inward}`
}

function deriveAreaDistrictSector(pc: string) {
  const [outward, inward] = pc.split(' ')
  const areaMatch = outward.match(/^[A-Z]+/)
  const area = areaMatch ? areaMatch[0] : outward
  const district = outward
  const sector = inward && inward.length > 0 ? `${outward} ${inward[0]}` : outward
  return { area, district, sector }
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isNaN(n) ? null : n
}

function truthyFlag(value: string | undefined): boolean {
  if (!value) return true // default to true if missing
  const v = value.trim().toLowerCase()
  return v === 'y' || v === 'yes' || v === '1' || v === 'true' || v === 't'
}

function splitCsvLine(line: string): string[] {
  // Simple splitter for typical postcode CSV (no quoted commas).
  // If your file ever contains quoted fields with commas,
  // we can swap this to a proper CSV parser later.
  return line.split(',').map((v) => v.trim())
}

function buildHeaderMap(headers: string[]): HeaderMap {
  const map: HeaderMap = {}
  headers.forEach((h, idx) => {
    map[h.toLowerCase()] = idx
  })
  return map
}

function getField(row: RawRow, headerMap: HeaderMap, name: string): string | undefined {
  const idx = headerMap[name.toLowerCase()]
  if (idx === undefined) return undefined
  return row[idx]
}

// ---------- main processing ----------

async function preprocess() {
  console.log('--- Preprocess uk_postcodes.csv ---')
  console.log('CSV path:', CSV_PATH)

  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ CSV file not found at', CSV_PATH)
    process.exit(1)
  }

  ensureDir(OUT_BY_CODE)
  ensureDir(OUT_BY_DISTRICT)

  const fileStream = fs.createReadStream(CSV_PATH)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let lineNumber = 0
  let headerMap: HeaderMap | null = null

  const districtIndex: Record<string, DistrictIndexItem[]> = {}

  let totalRows = 0
  let writtenByCode = 0
  let skippedNoCoords = 0
  let skippedNoPostcode = 0

  for await (const line of rl) {
    lineNumber++
    if (!line.trim()) continue

    if (lineNumber === 1) {
      const headers = splitCsvLine(line)
      headerMap = buildHeaderMap(headers)
      console.log('Detected CSV headers:', headers)
      continue
    }

    if (!headerMap) {
      console.error('No header row detected – aborting.')
      process.exit(1)
    }

    const cols = splitCsvLine(line)
    totalRows++

    const rawPc = getField(cols, headerMap, 'Postcode')
    if (!rawPc) {
      skippedNoPostcode++
      continue
    }

    const postcode = normalisePostcode(rawPc)
    if (!postcode) {
      skippedNoPostcode++
      continue
    }

    const latStr = getField(cols, headerMap, 'Latitude')
    const lonStr = getField(cols, headerMap, 'Longitude')
    const lat = parseNumber(latStr)
    const lon = parseNumber(lonStr)

    if (lat === null || lon === null) {
      skippedNoCoords++
      continue
    }

    const inUseStr = getField(cols, headerMap, 'In Use?')
    const inUse = truthyFlag(inUseStr)

    const easting = parseNumber(getField(cols, headerMap, 'Easting'))
    const northing = parseNumber(getField(cols, headerMap, 'Northing'))
    const gridref = getField(cols, headerMap, 'Grid Reference') ?? null
    const districtCode = getField(cols, headerMap, 'District Code') ?? null
    const wardCode = getField(cols, headerMap, 'Ward Code') ?? null
    const lsoa = getField(cols, headerMap, 'LSOA Code') ?? null
    const msoa = getField(cols, headerMap, 'MSOA Code') ?? null
    const itl2 = getField(cols, headerMap, 'ITL level 2') ?? null
    const itl3 = getField(cols, headerMap, 'ITL level 3') ?? null
    const country = getField(cols, headerMap, 'Country') ?? null

    const { area, district, sector } = deriveAreaDistrictSector(postcode)

    const record: PostcodeRecord = {
      postcode,
      area,
      district,
      sector,
      latitude: lat,
      longitude: lon,
      easting,
      northing,
      gridref,
      district_code: districtCode,
      ward_code: wardCode,
      lsoa_code: lsoa,
      msoa_code: msoa,
      itl_level_2: itl2,
      itl_level_3: itl3,
      country,
      in_use: inUse,
    }

    // Write per-postcode JSON
    const filename = postcode.replace(/\s+/, '-')
    const outPath = path.join(OUT_BY_CODE, `${filename}.json`)
    fs.writeFileSync(outPath, JSON.stringify(record), 'utf8')
    writtenByCode++

    // Build simple district index in memory
    if (!districtIndex[district]) {
      districtIndex[district] = []
    }
    districtIndex[district].push({
      postcode,
      latitude: lat,
      longitude: lon,
    })

    if (writtenByCode % 5000 === 0) {
      console.log(`Processed ${writtenByCode} postcodes...`)
    }
  }

  console.log('Writing district index files...')

  for (const [district, items] of Object.entries(districtIndex)) {
    const outPath = path.join(OUT_BY_DISTRICT, `${district}.json`)
    const payload = {
      district,
      count: items.length,
      postcodes: items,
    }
    fs.writeFileSync(outPath, JSON.stringify(payload), 'utf8')
  }

  console.log('--- Done ---')
  console.log('Total CSV rows:', totalRows)
  console.log('Postcodes written (by-code):', writtenByCode)
  console.log('Skipped (no postcode):', skippedNoPostcode)
  console.log('Skipped (no coords):', skippedNoCoords)
}

preprocess().catch((err) => {
  console.error('❌ Preprocess failed:', err)
  process.exit(1)
})
