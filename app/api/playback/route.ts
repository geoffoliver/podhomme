import { db, ensureSingletons } from '@/lib/db'
import { broadcast } from '@/lib/sse'
import { getNextEpisode, getPrevEpisode } from '@/lib/playback'

export async function GET() {
  await ensureSingletons()
  const state = await db.playbackState.findUniqueOrThrow({
    where: { id: 1 },
    include: {
      episode: {
        include: { podcast: { select: { title: true, imageUrl: true, author: true } } },
      },
    },
  })
  return Response.json(state)
}

export async function POST(request: Request) {
  await ensureSingletons()
  const body = await request.json()
  const { action } = body

  const current = await db.playbackState.findUniqueOrThrow({ where: { id: 1 } })

  let update: Parameters<typeof db.playbackState.update>[0]['data'] = {}

  if (action === 'load') {
    update = {
      episodeId: body.episodeId,
      position: 0,
      isPlaying: true,
      context: body.context ?? 'all',
      contextPodcastId: body.contextPodcastId ?? null,
    }
  } else if (action === 'play') {
    update = { isPlaying: true }
  } else if (action === 'pause') {
    update = { isPlaying: false, position: body.position ?? current.position }
  } else if (action === 'seek') {
    update = { position: body.position }
  } else if (action === 'sync') {
    update = { position: body.position }
  } else if (action === 'next' || action === 'prev') {
    if (!current.episodeId) return Response.json({ ok: true })

    const nextId = action === 'next'
      ? await getNextEpisode(current.episodeId, current.context, current.contextPodcastId)
      : await getPrevEpisode(current.episodeId, current.context, current.contextPodcastId)

    if (action === 'next') {
      // Mark current episode played
      const ep = await db.episode.update({
        where: { id: current.episodeId },
        data: { played: true, playedAt: new Date() },
      })
      await db.queueItem.deleteMany({ where: { episodeId: current.episodeId } })
      broadcast('episode', ep)
    }

    if (!nextId) {
      update = { isPlaying: false, episodeId: null, position: 0 }
    } else {
      update = { episodeId: nextId, position: 0, isPlaying: true }
    }
  } else {
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }

  const state = await db.playbackState.update({
    where: { id: 1 },
    data: update,
    include: {
      episode: {
        include: { podcast: { select: { title: true, imageUrl: true, author: true } } },
      },
    },
  })

  if (action !== 'sync') {
    broadcast('playback', state)
  }

  return Response.json(state)
}
