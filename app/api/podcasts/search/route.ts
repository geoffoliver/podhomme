import type { NextRequest } from 'next/server'
import iTunes from '@/lib/itunes'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q) return Response.json({ resultCount: 0, results: [] })

  const itunes = new iTunes()
  const data = await itunes.searchPodcasts(q)
  return Response.json(data)
}
