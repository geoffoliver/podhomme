import type { NextRequest } from 'next/server';
import { broadcast } from '@/lib/sse';
import { db } from '@/lib/db';

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/episodes/[id]'>) {
  const { id } = await ctx.params;
  const body = await request.json();
  const episodeId = Number(id);

  const data: Record<string, unknown> = {};

  if ('played' in body) {
    data.played = body.played;
    data.playedAt = body.played ? new Date() : null;
    if (body.played) data.resumeAt = 0;

    if (body.played) {
      // Remove from queue when marked played
      await db.queueItem.deleteMany({ where: { episodeId } });
    } else {
      // Re-add to queue at end when marked unplayed
      const existing = await db.queueItem.findUnique({ where: { episodeId } });
      if (!existing) {
        const maxPos = await db.queueItem.aggregate({ _max: { position: true } });
        await db.queueItem.create({
          data: { episodeId, position: (maxPos._max.position ?? -1) + 1 },
        });
      }
      broadcast('queue', null);
    }
  }

  if ('favorited' in body) {
    data.favorited = body.favorited;
    data.favoritedAt = body.favorited ? new Date() : null;
  }

  const episode = await db.episode.update({ where: { id: episodeId }, data });
  broadcast('episode', episode);
  return Response.json(episode);
}
