// src/app/page.tsx
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <SiteHeader />

      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 py-12 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-gray-500">
          UK Hiking Directory · Early Preview
        </p>

        <h1 className="mb-4 text-balance text-3xl font-semibold sm:text-4xl">
          Discover UK hiking routes by <span className="text-green-700">map</span>,
          <span className="text-green-700"> postcode</span>, and{' '}
          <span className="text-green-700">public transport</span>.
        </h1>

        <p className="mb-8 max-w-2xl text-balance text-gray-600">
          This directory aims to collect GPX files, transport links, and detailed
          route information for hiking trails across the UK. It’s a work in
          progress – you can already browse routes and explore them on the map.
        </p>

        {/* Main CTA buttons */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/find"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
          >
            🥾 Find hikes (list view)
          </Link>

          <Link
            href="/find/map"
            className="inline-flex items-center justify-center rounded-full bg-green-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800"
          >
            🗺️ Explore map
          </Link>
        </div>

        <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 text-sm">
            <h2 className="mb-1 text-sm font-semibold">GPX-ready routes</h2>
            <p className="text-xs text-gray-600">
              Each hike will eventually include GPX downloads so you can use
              them on your phone or GPS device.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            <h2 className="mb-1 text-sm font-semibold">Postcode &amp; transport</h2>
            <p className="text-xs text-gray-600">
              Trails are linked to nearby postcodes, train stations and bus
              stops to make car-free hiking easier.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            <h2 className="mb-1 text-sm font-semibold">Built for discovery</h2>
            <p className="text-xs text-gray-600">
              Map view, filters and programmatic SEO pages will help you discover
              hidden walking routes across the UK.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
