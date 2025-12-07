import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Hello from API route.ts',
  })
}
