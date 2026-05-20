import { db, ensureSingletons } from '@/lib/db';
import { getNextEpisode, getPrevEpisode } from '@/lib/playback';
import { broadcast } from '@/lib/sse';

export async function GET() {
  await ensureSingletons();
  const state = await db.playbackState.findUniqueOrThrow({
    where: { id: 1 },
    include: {
      episode: {
        include: {
          podcast: {
            select: {
              title: true,
              imageUrl: true,
              author: true,
            },
          },
        },
      },
    },
  });
  return Response.json(state);
}

export async function POST(request: Request) {
  await ensureSingletons();
  const body = await request.json();
  const { action } = body;

  const current = await db.playbackState.findUniqueOrThrow({
    where: { id: 1 },
  });

  let update: Parameters<typeof db.playbackState.update>[0]['data'] = {};

  if (action === 'load') {
    // Save current position to the outgoing episode
    if (current.episodeId) {
      const saved = await db.episode.update({
        where: { id: current.episodeId },
        data: { resumeAt: current.position },
      });
      broadcast('episode', saved);
    }
    // Start the new episode at its saved resume point
    const incoming = await db.episode.findUnique({
      where: { id: body.episodeId },
      select: { resumeAt: true },
    });
    update = {
      episodeId: body.episodeId,
      position: incoming?.resumeAt ?? 0,
      isPlaying: true,
      context: body.context ?? 'all',
      contextPodcastId: body.contextPodcastId ?? null,
    };
  } else if (action === 'play') {
    update = { isPlaying: true };
  } else if (action === 'pause') {
    const pos = body.position ?? current.position;
    update = { isPlaying: false, position: pos };
    if (current.episodeId) {
      const saved = await db.episode.update({
        where: { id: current.episodeId },
        data: { resumeAt: pos },
      });
      broadcast('episode', saved);
    }
  } else if (action === 'seek') {
    update = { position: body.position };
  } else if (action === 'sync') {
    update = { position: body.position };
    // Keep resumeAt current without broadcasting (runs every 5s)
    if (current.episodeId) {
      await db.episode.update({
        where: { id: current.episodeId },
        data: { resumeAt: body.position },
      });
    }
  } else if (action === 'next' || action === 'prev') {
    if (!current.episodeId) return Response.json({ ok: true });

    const nextId =
      action === 'next'
        ? await getNextEpisode(
            current.episodeId,
            current.context,
            current.contextPodcastId,
          )
        : await getPrevEpisode(
            current.episodeId,
            current.context,
            current.contextPodcastId,
          );

    if (action === 'next') {
      // Episode finished — mark played and clear resume point
      const ep = await db.episode.update({
        where: { id: current.episodeId },
        data: {
          played: true,
          playedAt: new Date(),
          resumeAt: 0,
        },
      });
      await db.queueItem.deleteMany({
        where: { episodeId: current.episodeId },
      });
      broadcast('episode', ep);
    } else {
      // Navigating back — save current position so we can return here
      const saved = await db.episode.update({
        where: { id: current.episodeId },
        data: { resumeAt: current.position },
      });
      broadcast('episode', saved);
    }

    if (!nextId) {
      update = {
        isPlaying: false,
        episodeId: null,
        position: 0,
      };
    } else {
      const incoming = await db.episode.findUnique({
        where: { id: nextId },
        select: { resumeAt: true },
      });
      update = {
        episodeId: nextId,
        position: incoming?.resumeAt ?? 0,
        isPlaying: true,
      };
    }
  } else {
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  }

  const state = await db.playbackState.update({
    where: { id: 1 },
    data: update,
    include: {
      episode: {
        include: {
          podcast: {
            select: {
              title: true,
              imageUrl: true,
              author: true,
            },
          },
        },
      },
    },
  });

  if (action !== 'sync') {
    broadcast('playback', state);
  }

  return Response.json(state);
}
