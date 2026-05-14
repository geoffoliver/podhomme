import { db } from '@/lib/db'
import { parseFeed, parseOpml } from '@/lib/feed'
import { broadcast } from '@/lib/sse'
import { cachePodcastImage } from '@/lib/imageCache'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof Blob)) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const xml = await file.text()
  const outlines = parseOpml(xml)
  if (!outlines.length) {
    return Response.json({ error: 'No feeds found in OPML' }, { status: 422 })
  }

  const results: { feedUrl: string; status: 'added' | 'exists' | 'error' }[] = []

  for (const outline of outlines) {
    const existing = await db.podcast.findUnique({ where: { feedUrl: outline.feedUrl } })
    if (existing) {
      results.push({ feedUrl: outline.feedUrl, status: 'exists' })
      continue
    }

    try {
      const feed = await parseFeed(outline.feedUrl)
      const podcast = await db.podcast.create({
        data: {
          feedUrl: outline.feedUrl,
          title: feed.title,
          description: feed.description,
          imageUrl: feed.imageUrl,  // temp; replaced after we have the ID
          siteUrl: feed.siteUrl,
          author: feed.author,
          type: feed.type,
          lastRefreshedAt: new Date(),
        },
      })

      const cachedImageUrl = await cachePodcastImage(feed.imageUrl, podcast.id)
      if (cachedImageUrl !== feed.imageUrl) {
        await db.podcast.update({ where: { id: podcast.id }, data: { imageUrl: cachedImageUrl } })
      }

      for (let i = 0; i < feed.episodes.length; i++) {
        const ep = feed.episodes[i]
        const isLatest = i === 0
        const episode = await db.episode.create({
          data: {
            podcastId: podcast.id,
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
        }
      }

      broadcast('podcast', podcast)
      results.push({ feedUrl: outline.feedUrl, status: 'added' })
    } catch (ex: any) {
      console.error(`Error importing feed ${outline.feedUrl}:`, ex)
      results.push({ feedUrl: outline.feedUrl, status: 'error' })
    }
  }

  return Response.json({ results })
}
