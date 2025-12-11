'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const navLinks = [
  { href: '/find', label: 'Find hikes' },
  { href: '/regions', label: 'Regions' },
  { href: '/themes', label: 'Themes' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + brand */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/hiking-directory-logo.svg" // change if your file is .png or has another name
              alt="Hiking Directory"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-contain"
              priority
            />
            <span className="text-base font-semibold tracking-tight text-slate-900">
              UK Hiking Directory
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/find"
            className="rounded-full border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-600 hover:text-white"
          >
            Find a hike
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          <span className="sr-only">Open main menu</span>
          <div className="flex flex-col gap-1.5">
            <span
              className={`block h-0.5 w-5 rounded-full bg-slate-900 transition-transform ${
                isOpen ? 'translate-y-1.5 rotate-45' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-5 rounded-full bg-slate-900 transition-opacity ${
                isOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`block h-0.5 w-5 rounded-full bg-slate-900 transition-transform ${
                isOpen ? '-translate-y-1.5 -rotate-45' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile nav panel */}
      {isOpen && (
        <nav className="border-t border-slate-200 bg-white lg:hidden">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-2 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href="/find"
                className="mt-1 inline-flex items-center justify-center rounded-full border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                Find a hike
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
