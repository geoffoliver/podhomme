import { startRefresh } from '@/lib/refresh';

export async function POST(request: Request) {
  const force = new URL(request.url).searchParams.get('force') === 'true';
  const result = await startRefresh(force);
  return Response.json({ ok: true, ...result });
}
