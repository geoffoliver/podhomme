import '../envConfig'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../app/generated/prisma/client'
import { parseFeed } from '../lib/feed'

const url = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url })
const db = new PrismaClient({ adapter })

async function refreshAll() {
  const podcasts = await db.podcast.findMany()

  for (const podcast of podcasts) {
    try {
      const feed = await parseFeed(podcast.feedUrl)

      await db.podcast.update({
        where: { id: podcast.id },
        data: {
          title: feed.title,
          description: feed.description,
          imageUrl: feed.imageUrl,
          siteUrl: feed.siteUrl,
          author: feed.author,
          type: feed.type,
          lastRefreshedAt: new Date(),
        },
      })

      for (const ep of feed.episodes) {
        const existing = await db.episode.findUnique({
          where: { podcastId_guid: { podcastId: podcast.id, guid: ep.guid } },
        })
        if (existing) continue

        const episode = await db.episode.create({
          data: {
            podcastId: podcast.id,
            guid: ep.guid,
            title: ep.title,
            description: ep.description,
            audioUrl: ep.audioUrl,
            imageUrl: ep.imageUrl,
            duration: ep.duration,
            pubDate: ep.pubDate,
          },
        })

        const maxPos = await db.queueItem.aggregate({ _max: { position: true } })
        await db.queueItem.create({
          data: { episodeId: episode.id, position: (maxPos._max.position ?? -1) + 1 },
        })
      }

      console.log(`[worker] Refreshed: ${podcast.title}`)
    } catch (err) {
      console.error(`[worker] Failed to refresh ${podcast.title}:`, err)
    }
  }
}

async function main() {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
  await db.playbackState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })

  let lastRefresh = 0

  while (true) {
    const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } })
    const intervalMs = settings.refreshFrequency * 60 * 1000
    const now = Date.now()

    if (now - lastRefresh >= intervalMs) {
      console.log('[worker] Starting scheduled refresh…')
      lastRefresh = now
      await refreshAll()
      console.log('[worker] Refresh complete.')
    }

    await new Promise(resolve => setTimeout(resolve, 60_000))
  }
}

main().catch(err => {
  console.error('[worker] Fatal error:', err)
  process.exit(1)
})
