import { broadcast } from '@/lib/sse';
import { db } from '@/lib/db';

export async function GET() {
  const items = await db.queueItem.findMany({
    orderBy: { position: 'asc' },
    include: {
      episode: {
        include: {
          podcast: {
            select: {
              title: true,
              imageUrl: true,
              author: true,
              type: true,
              typeOverride: true,
            },
          },
        },
      },
    },
  });
  return Response.json(items);
}

export async function PATCH(request: Request) {
  // Body: array of { id, position }
  const updates: { id: number; position: number }[] = await request.json();

  await db.$transaction(
    updates.map(({ id, position }) =>
      db.queueItem.update({ where: { id }, data: { position } }),
    ),
  );

  broadcast('queue', null);
  return Response.json({ ok: true });
}
