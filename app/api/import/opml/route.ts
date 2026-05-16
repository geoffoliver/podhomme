import { parseFeed, parseOpml } from '@/lib/feed';
import { broadcast } from '@/lib/sse';
import { db } from '@/lib/db';
import logger from '@/lib/logger';

const log = logger.child({ module: 'opml' });

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const xml = await file.text();
  const outlines = parseOpml(xml);
  if (!outlines.length) {
    return Response.json({ error: 'No feeds found in OPML' }, { status: 422 });
  }

  const results: { feedUrl: string; status: 'added' | 'exists' | 'error' }[] = [];
  log.info({ total: outlines.length }, 'Starting OPML import');

  for (const outline of outlines) {
    const existing = await db.podcast.findUnique({ where: { feedUrl: outline.feedUrl } });
    if (existing) {
      log.debug({ feedUrl: outline.feedUrl }, 'Feed already subscribed, skipping');
      results.push({ feedUrl: outline.feedUrl, status: 'exists' });
      continue;
    }

    try {
      log.info({ feedUrl: outline.feedUrl }, 'Importing feed');
      const feed = await parseFeed(outline.feedUrl);
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
      });

      const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
      const newestPubDate = feed.episodes.length > 0 ? new Date(feed.episodes[0].pubDate).getTime() : 0;
      const allPlayed = feed.episodes.length > 0 && (Date.now() - newestPubDate) > SIXTY_DAYS_MS;

      for (let i = 0; i < feed.episodes.length; i++) {
        const ep = feed.episodes[i];
        const isLatest = i === 0 && !allPlayed;
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
        });

        if (isLatest) {
          const maxPos = await db.queueItem.aggregate({ _max: { position: true } });
          await db.queueItem.create({
            data: { episodeId: episode.id, position: (maxPos._max.position ?? -1) + 1 },
          });
        }
      }

      broadcast('podcast', podcast);
      log.info({
 feedUrl: outline.feedUrl, title: feed.title, episodes: feed.episodes.length,
}, 'Feed imported');
      results.push({ feedUrl: outline.feedUrl, status: 'added' });
    } catch (ex: any) {
      log.error({ feedUrl: outline.feedUrl, err: ex }, 'Failed to import feed');
      results.push({ feedUrl: outline.feedUrl, status: 'error' });
    }
  }

  const added = results.filter(r => r.status === 'added').length;
  const skipped = results.filter(r => r.status === 'exists').length;
  const failed = results.filter(r => r.status === 'error').length;
  log.info({
 added, skipped, failed,
}, 'OPML import complete');

  return Response.json({ results });
}
