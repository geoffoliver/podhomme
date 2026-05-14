import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/feed'
import { broadcast } from '@/lib/sse'
import { cachePodcastImage } from '@/lib/imageCache'

export async function refreshPodcast(podcastId: number) {
  const podcast = await db.podcast.findUniqueOrThrow({ where: { id: podcastId } })

  const feed = await parseFeed(podcast.feedUrl)

  const imageUrl = await cachePodcastImage(feed.imageUrl, podcastId)

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

  // Only the newest new episode (index 0) is unplayed and queued; the rest come in as played
  for (let i = 0; i < newEpisodes.length; i++) {
    const ep = newEpisodes[i]
    const isLatest = i === 0

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

    if (isLatest) {
      const maxPos = await db.queueItem.aggregate({ _max: { position: true } })
      await db.queueItem.create({
        data: { episodeId: episode.id, position: (maxPos._max.position ?? -1) + 1 },
      })
      await maybeDownload(episode.id, episode.audioUrl, settings.defaultPlayback, settings.downloadLocation)
    }
  }

  await pruneEpisodes(podcastId, settings.episodesToKeep)

  const updated = await db.podcast.findUniqueOrThrow({
    where: { id: podcastId },
    include: { episodes: true },
  })
  broadcast('podcast', updated)
}

export async function refreshAll(onProgress?: (title: string, current: number, total: number) => void) {
  const podcasts = await db.podcast.findMany()
  for (let i = 0; i < podcasts.length; i++) {
    const p = podcasts[i]
    onProgress?.(p.title, i + 1, podcasts.length)
    broadcast('refresh', { podcastTitle: p.title, current: i + 1, total: podcasts.length, done: false })
    try {
      await refreshPodcast(p.id)
    } catch (err) {
      console.error(`Failed to refresh ${p.title}:`, err)
    }
  }
  broadcast('refresh', { done: true })
}

async function maybeDownload(episodeId: number, audioUrl: string, defaultPlayback: string, downloadLocation: string) {
  if (defaultPlayback !== 'download') return

  try {
    await mkdir(downloadLocation, { recursive: true })

    const res = await fetch(audioUrl)
    if (!res.ok) return

    const ext = audioUrl.split('.').pop()?.split('?')[0] || 'mp3'
    const filename = `${episodeId}.${ext}`
    const filepath = path.join(downloadLocation, filename)

    const buffer = await res.arrayBuffer()
    await writeFile(filepath, Buffer.from(buffer))

    await db.episode.update({
      where: { id: episodeId },
      data: { downloadPath: filepath, fileSize: buffer.byteLength },
    })
  } catch (err) {
    console.error(`Failed to download episode ${episodeId}:`, err)
  }
}

async function pruneEpisodes(podcastId: number, episodesToKeep: string) {
  if (episodesToKeep === 'all') return

  if (episodesToKeep === 'all_unplayed') {
    // Delete played episodes that have no download
    await db.episode.deleteMany({
      where: { podcastId, played: true, downloadPath: null },
    })
    return
  }

  const limit = parseInt(episodesToKeep, 10)
  if (isNaN(limit)) return

  const episodes = await db.episode.findMany({
    where: { podcastId },
    orderBy: { pubDate: 'desc' },
  })

  const toDelete = episodes.slice(limit)
  for (const ep of toDelete) {
    await db.episode.delete({ where: { id: ep.id } })
  }
}
