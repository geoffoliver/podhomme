import { db, ensureSingletons } from '@/lib/db';

export async function GET() {
  await ensureSingletons();
  const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  return Response.json(settings);
}

export async function PATCH(request: Request) {
  await ensureSingletons();
  const body = await request.json();
  const allowed = [
    'refreshFrequency',
    'episodesToKeep',
    'defaultPlayback',
    'downloadLocation',
  ];
  const data = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k)),
  );
  const settings = await db.settings.update({ where: { id: 1 }, data });
  return Response.json(settings);
}
