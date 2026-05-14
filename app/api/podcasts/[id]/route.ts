import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { broadcast } from '@/lib/sse'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/podcasts/[id]'>) {
  const { id } = await ctx.params
  const podcast = await db.podcast.findUnique({
    where: { id: Number(id) },
    include: { episodes: { orderBy: { pubDate: 'desc' } } },
  })
  if (!podcast) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(podcast)
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/podcasts/[id]'>) {
  const { id } = await ctx.params
  const body = await request.json()
  const allowed = ['typeOverride', 'title', 'description']
  const data = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )
  const podcast = await db.podcast.update({ where: { id: Number(id) }, data })
  broadcast('podcast', podcast)
  return Response.json(podcast)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/podcasts/[id]'>) {
  const { id } = await ctx.params
  await db.podcast.delete({ where: { id: Number(id) } })
  broadcast('podcast', { id: Number(id), deleted: true })
  return new Response(null, { status: 204 })
}
