import { broadcast } from '@/lib/sse';
import { db } from '@/lib/db';
import { parseFeed } from '@/lib/feed';

export async function GET() {
  const podcasts = await db.podcast.findMany({
    orderBy: { title: 'asc' },
    include: { _count: { select: { episodes: { where: { played: false } } } } },
  });
  return Response.json(podcasts);
}

export async function POST(request: Request) {
  const { feedUrl } = await request.json();
  if (!feedUrl || typeof feedUrl !== 'string') {
    return Response.json({ error: 'feedUrl required' }, { status: 400 });
  }

  const existing = await db.podcast.findUnique({ where: { feedUrl } });
  if (existing) {
    return Response.json({ error: 'Already subscribed' }, { status: 409 });
  }

  let feed;
  try {
    const result = await parseFeed(feedUrl);
    if (result.notModified) {
      return Response.json({ error: 'Could not parse feed' }, { status: 422 });
    }
    feed = result.feed;
  } catch {
    return Response.json({ error: 'Could not parse feed' }, { status: 422 });
  }

  const podcast = await db.podcast.create({
    data: {
      feedUrl,
      title: feed.title,
      description: feed.description,
      imageUrl: feed.imageUrl, // temp; replaced after we have the ID
      siteUrl: feed.siteUrl,
      author: feed.author,
      type: feed.type,
      lastRefreshedAt: new Date(),
    },
  });

  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const newestPubDate =
    feed.episodes.length > 0 ? new Date(feed.episodes[0].pubDate).getTime() : 0;
  const allPlayed =
    feed.episodes.length > 0 && Date.now() - newestPubDate > SIXTY_DAYS_MS;

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
        mediaType: ep.mediaType,
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
        data: {
          episodeId: episode.id,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
    }
  }

  broadcast('podcast', podcast);
  return Response.json(podcast, { status: 201 });
}
