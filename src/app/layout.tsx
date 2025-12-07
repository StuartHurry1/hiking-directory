import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hiking Directory',
  description: 'Find UK hikes by postcode',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
