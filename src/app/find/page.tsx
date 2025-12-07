'use client'

import { FormEvent, useState } from 'react'

type HikeResult = {
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
  distanceFromPostcodeKm: number
}

type ApiResponse =
  | {
      error: string
    }
  | {
      postcode: string
      normalisedPostcode: string
      maxDistanceKm: number
      limit: number
      resultCount: number
      results: HikeResult[]
    }

export default function FindHikesPage() {
  const [postcode, setPostcode] = useState('S66 7RR')
  const [distanceKm, setDistanceKm] = useState('50')
  const [limit, setLimit] = useState('10')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setData(null)

    try {
      const params = new URLSearchParams({
        postcode,
        distance: distanceKm,
        limit,
      })

      const res = await fetch(`/api/hikes/near-postcode?${params.toString()}`)
      const json = (await res.json()) as ApiResponse

      if (!res.ok) {
        const message = 'error' in json ? json.error : 'Unknown error'
        setError(message)
      } else {
        setData(json)
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong calling the API.')
    } finally {
      setLoading(false)
    }
  }

  const isDataOk =
    data &&
    'results' in data &&
    Array.isArray(data.results) &&
    !('error' in data)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900">
          Find hikes near a postcode
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Postcode
            </label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. S66 7RR"
              required
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Max distance (km)
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Max results
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {loading ? 'Searching…' : 'Find hikes'}
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {isDataOk && 'results' in data && (
          <section className="space-y-3">
            <p className="text-sm text-slate-600">
              Showing {data.resultCount} result
              {data.resultCount === 1 ? '' : 's'} within {data.maxDistanceKm} km
              of <strong>{data.postcode}</strong>
            </p>

            {data.results.map((hike) => (
              <article
                key={hike.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {hike.name}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                    {hike.difficulty}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-600">{hike.region}</p>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-700">
                  <span>
                    <strong>Distance:</strong> {hike.distance_km} km
                  </span>
                  <span>
                    <strong>From postcode:</strong>{' '}
                    {hike.distanceFromPostcodeKm} km
                  </span>
                  {hike.start.nearest_postcode && (
                    <span>
                      <strong>Start near:</strong>{' '}
                      {hike.start.nearest_postcode}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Start coordinates: {hike.start.lat.toFixed(5)},{' '}
                  {hike.start.lon.toFixed(5)}
                </p>
              </article>
            ))}
          </section>
        )}

        {!error && !loading && data && !isDataOk && (
          <p className="text-sm text-slate-600">
            No hikes were found for that search.
          </p>
        )}
      </div>
    </main>
  )
}
