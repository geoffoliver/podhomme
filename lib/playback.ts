import { db } from '@/lib/db'

export async function getNextEpisode(
  currentEpisodeId: number,
  context: string,
  contextPodcastId: number | null
): Promise<number | null> {
  if (context === 'all') {
    const currentItem = await db.queueItem.findUnique({ where: { episodeId: currentEpisodeId } })
    if (!currentItem) return null

    const next = await db.queueItem.findFirst({
      where: { position: { gt: currentItem.position } },
      orderBy: { position: 'asc' },
    })
    return next?.episodeId ?? null
  }

  if (context === 'podcast' && contextPodcastId) {
    const current = await db.episode.findUnique({ where: { id: currentEpisodeId } })
    if (!current) return null

    const podcast = await db.podcast.findUnique({ where: { id: contextPodcastId } })
    if (!podcast) return null

    const effectiveType = podcast.typeOverride || podcast.type
    const isSerial = effectiveType === 'serial'

    const next = await db.episode.findFirst({
      where: {
        podcastId: contextPodcastId,
        pubDate: isSerial
          ? { gt: current.pubDate }
          : { lt: current.pubDate },
      },
      orderBy: { pubDate: isSerial ? 'asc' : 'desc' },
    })
    return next?.id ?? null
  }

  if (context === 'favorites') {
    const current = await db.episode.findUnique({ where: { id: currentEpisodeId } })
    if (!current || !current.favoritedAt) return null

    const next = await db.episode.findFirst({
      where: {
        favorited: true,
        favoritedAt: { lt: current.favoritedAt },
      },
      orderBy: { favoritedAt: 'desc' },
    })
    return next?.id ?? null
  }

  return null
}

export async function getPrevEpisode(
  currentEpisodeId: number,
  context: string,
  contextPodcastId: number | null
): Promise<number | null> {
  if (context === 'all') {
    const currentItem = await db.queueItem.findUnique({ where: { episodeId: currentEpisodeId } })
    if (!currentItem) return null

    const prev = await db.queueItem.findFirst({
      where: { position: { lt: currentItem.position } },
      orderBy: { position: 'desc' },
    })
    return prev?.episodeId ?? null
  }

  if (context === 'podcast' && contextPodcastId) {
    const current = await db.episode.findUnique({ where: { id: currentEpisodeId } })
    if (!current) return null

    const podcast = await db.podcast.findUnique({ where: { id: contextPodcastId } })
    if (!podcast) return null

    const effectiveType = podcast.typeOverride || podcast.type
    const isSerial = effectiveType === 'serial'

    const prev = await db.episode.findFirst({
      where: {
        podcastId: contextPodcastId,
        pubDate: isSerial
          ? { lt: current.pubDate }
          : { gt: current.pubDate },
      },
      orderBy: { pubDate: isSerial ? 'desc' : 'asc' },
    })
    return prev?.id ?? null
  }

  if (context === 'favorites') {
    const current = await db.episode.findUnique({ where: { id: currentEpisodeId } })
    if (!current || !current.favoritedAt) return null

    const prev = await db.episode.findFirst({
      where: {
        favorited: true,
        favoritedAt: { gt: current.favoritedAt },
      },
      orderBy: { favoritedAt: 'asc' },
    })
    return prev?.id ?? null
  }

  return null
}
