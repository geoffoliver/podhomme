import { refreshAll } from '@/lib/refresh'

export async function POST() {
  // Fire-and-forget; progress is broadcast via SSE
  refreshAll().catch(console.error)
  return Response.json({ ok: true })
}
