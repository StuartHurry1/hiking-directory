import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'UK Hiking Directory',
  description: 'Find the best hiking trails across the UK, by train, bus, or car-free.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <SiteHeader />
        <main className="min-h-screen pb-10">{children}</main>
      </body>
    </html>
  );
}
