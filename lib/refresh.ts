import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/feed'
import { broadcast } from '@/lib/sse'
import { cachePodcastImage } from '@/lib/imageCache'
import logger from '@/lib/logger'

const log = logger.child({ module: 'refresh' })

export async function refreshPodcast(podcastId: number) {
  const podcast = await db.podcast.findUniqueOrThrow({ where: { id: podcastId } })
  log.info({ podcastId, title: podcast.title }, 'Refreshing podcast')

  const feed = await parseFeed(podcast.feedUrl)
  log.debug({ podcastId, title: podcast.title, episodeCount: feed.episodes.length }, 'Feed parsed')

  const cachedImageUrl = await cachePodcastImage(feed.imageUrl, podcastId)
  // If caching failed (remote URL returned) and we already have a local image, keep it
  const imageUrl = (cachedImageUrl && !cachedImageUrl.startsWith('/') && podcast.imageUrl)
    ? podcast.imageUrl
    : cachedImageUrl

  if (imageUrl !== cachedImageUrl) {
    log.info({ podcastId, title: podcast.title }, 'Image download failed; retaining existing cached image')
  }

  await db.podcast.update({
    where: { id: podcastId },
    data: {
      title: feed.title,
      description: feed.description,
      imageUrl,
      siteUrl: feed.siteUrl,
      author: feed.author,
      type: feed.type,
      lastRefreshedAt: new Date(),
    },
  })

  const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } })

  // Collect only episodes that don't exist yet (feed is newest-first)
  const newEpisodes: typeof feed.episodes = []
  for (const ep of feed.episodes) {
    const existing = await db.episode.findUnique({
      where: { podcastId_guid: { podcastId, guid: ep.guid } },
    })
    if (!existing) newEpisodes.push(ep)
  }

  if (newEpisodes.length === 0) {
    log.info({ podcastId, title: podcast.title }, 'No new episodes')
  } else {
    log.info({ podcastId, title: podcast.title, newEpisodes: newEpisodes.length }, 'New episodes found')
  }

  // Sort newest-first regardless of feed ordering, so index 0 is always the most recent
  newEpisodes.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // Find the most recent pubDate already in the DB *before* we start inserting.
  // This catches the case where a pruned episode reappears in the feed: it should
  // never come back as unplayed just because it was deleted from our DB.
  const mostRecentStored = await db.episode.findFirst({
    where: { podcastId },
    orderBy: { pubDate: 'desc' },
    select: { pubDate: true },
  })
  const mostRecentPubDate = mostRecentStored?.pubDate ?? new Date(0)

  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000
  const newestPubDate = newEpisodes.length > 0 ? new Date(newEpisodes[0].pubDate).getTime() : 0
  const allPlayed = newEpisodes.length > 0 && (Date.now() - newestPubDate) > SIXTY_DAYS_MS
  if (allPlayed) {
    log.info({ podcastId, title: podcast.title, newestPubDate: newEpisodes[0].pubDate }, 'Newest episode is over 60 days old — marking all new episodes as played')
  }

  // Only the single newest episode is unplayed and queued. It must also be genuinely
  // newer than everything already stored — guards against pruned episodes re-appearing.
  for (let i = 0; i < newEpisodes.length; i++) {
    const ep = newEpisodes[i]
    const isGenuinelyNew = new Date(ep.pubDate) > mostRecentPubDate
    const isLatest = i === 0 && !allPlayed && isGenuinelyNew

    const episode = await db.episode.create({
      data: {
        podcastId,
        guid: ep.guid,
        title: ep.title,
        description: ep.description,
        audioUrl: ep.audioUrl,
        imageUrl: null,
        duration: ep.duration,
        pubDate: ep.pubDate,
        played: !isLatest,
        playedAt: !isLatest ? new Date() : null,
      },
    })

    log.debug({ podcastId, episodeId: episode.id, title: ep.title, isLatest }, 'Episode created')

    if (isLatest) {
      const maxPos = await db.queueItem.aggregate({ _max: { position: true } })
      await db.queueItem.create({
        data: { episodeId: episode.id, position: (maxPos._max.position ?? -1) + 1 },
      })
      log.info({ podcastId, episodeId: episode.id, title: ep.title }, 'Latest episode added to queue')
      await maybeDownload(episode.id, episode.audioUrl, settings.defaultPlayback, settings.downloadLocation)
    }
  }

  await pruneEpisodes(podcastId, settings.episodesToKeep, settings.defaultPlayback)

  const updated = await db.podcast.findUniqueOrThrow({
    where: { id: podcastId },
    include: { episodes: true },
  })
  broadcast('podcast', updated)
  log.info({ podcastId, title: podcast.title }, 'Podcast refresh complete')
}

export async function refreshAll(onProgress?: (title: string, current: number, total: number) => void) {
  const podcasts = await db.podcast.findMany()
  log.info({ total: podcasts.length }, 'Starting full refresh')

  for (let i = 0; i < podcasts.length; i++) {
    const p = podcasts[i]
    onProgress?.(p.title, i + 1, podcasts.length)
    broadcast('refresh', { podcastTitle: p.title, current: i + 1, total: podcasts.length, done: false })
    try {
      await refreshPodcast(p.id)
    } catch (err) {
      log.error({ podcastId: p.id, title: p.title, err }, 'Failed to refresh podcast')
    }
  }

  broadcast('refresh', { done: true })
  log.info({ total: podcasts.length }, 'Full refresh complete')
}

async function maybeDownload(episodeId: number, audioUrl: string, defaultPlayback: string, downloadLocation: string) {
  if (defaultPlayback !== 'download') return

  log.info({ episodeId }, 'Downloading episode audio')
  try {
    await mkdir(downloadLocation, { recursive: true })

    const res = await fetch(audioUrl)
    if (!res.ok) {
      log.warn({ episodeId, status: res.status }, 'Failed to fetch audio for download')
      return
    }

    const ext = audioUrl.split('.').pop()?.split('?')[0] || 'mp3'
    const filename = `${episodeId}.${ext}`
    const filepath = path.join(downloadLocation, filename)

    const buffer = await res.arrayBuffer()
    await writeFile(filepath, Buffer.from(buffer))

    await db.episode.update({
      where: { id: episodeId },
      data: { downloadPath: filepath, fileSize: buffer.byteLength },
    })
    log.info({ episodeId, filepath, bytes: buffer.byteLength }, 'Episode audio downloaded')
  } catch (err) {
    log.error({ episodeId, err }, 'Failed to download episode audio')
  }
}

async function pruneEpisodes(podcastId: number, episodesToKeep: string, defaultPlayback: string) {
  if (defaultPlayback !== 'download') return
  if (episodesToKeep === 'all') return

  if (episodesToKeep === 'all_unplayed') {
    const played = await db.episode.findMany({
      where: { podcastId, played: true, downloadPath: { not: null } },
      select: { id: true, downloadPath: true },
    })
    let pruned = 0
    for (const ep of played) {
      try {
        await rm(ep.downloadPath!, { force: true })
        await db.episode.update({ where: { id: ep.id }, data: { downloadPath: null, fileSize: null } })
        pruned++
      } catch (err) {
        log.warn({ podcastId, episodeId: ep.id, err }, 'Failed to delete downloaded file')
      }
    }
    if (pruned > 0) log.info({ podcastId, pruned }, 'Pruned downloaded files for played episodes')
    return
  }

  const limit = parseInt(episodesToKeep, 10)
  if (isNaN(limit)) return

  const downloaded = await db.episode.findMany({
    where: { podcastId, downloadPath: { not: null } },
    orderBy: { pubDate: 'desc' },
    select: { id: true, downloadPath: true },
  })
  const toDelete = downloaded.slice(limit)
  let pruned = 0
  for (const ep of toDelete) {
    try {
      await rm(ep.downloadPath!, { force: true })
      await db.episode.update({ where: { id: ep.id }, data: { downloadPath: null, fileSize: null } })
      pruned++
    } catch (err) {
      log.warn({ podcastId, episodeId: ep.id, err }, 'Failed to delete downloaded file')
    }
  }
  if (pruned > 0) log.info({ podcastId, pruned }, 'Pruned old downloaded files')
}
