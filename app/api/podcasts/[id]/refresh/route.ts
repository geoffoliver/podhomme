import type { NextRequest } from 'next/server'
import { refreshPodcast } from '@/lib/refresh'

export async function POST(_req: NextRequest, ctx: RouteContext<'/api/podcasts/[id]/refresh'>) {
  const { id } = await ctx.params
  try {
    await refreshPodcast(Number(id))
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
