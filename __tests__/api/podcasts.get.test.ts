import { GET } from '@/app/api/podcasts/route';
import { db } from '@/lib/db';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/podcasts', () => {
  it('returns 200 with an empty array when no podcasts are subscribed', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns all subscribed podcasts', async () => {
    await db.podcast.createMany({
      data: [
        { title: 'Podcast B', feedUrl: 'https://feeds.example.com/b.rss' },
        { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' },
      ],
    });

    const body = await (await GET()).json();
    expect(body).toHaveLength(2);
  });

  it('orders podcasts alphabetically by title', async () => {
    await db.podcast.createMany({
      data: [
        { title: 'Zebra Cast', feedUrl: 'https://feeds.example.com/z.rss' },
        { title: 'Alpha Pod', feedUrl: 'https://feeds.example.com/a.rss' },
        { title: 'Middle Show', feedUrl: 'https://feeds.example.com/m.rss' },
      ],
    });

    const body = await (await GET()).json();
    expect(body.map((p: any) => p.title)).toEqual([
      'Alpha Pod',
      'Middle Show',
      'Zebra Cast',
    ]);
  });

  it('includes unplayed episode count on each podcast', async () => {
    const podcast = await db.podcast.create({
      data: { title: 'Pod', feedUrl: 'https://feeds.example.com/pod.rss' },
    });
    await db.episode.createMany({
      data: [
        {
          podcastId: podcast.id,
          guid: 'ep-1',
          title: 'E1',
          audioUrl: 'u',
          pubDate: new Date(),
          played: false,
        },
        {
          podcastId: podcast.id,
          guid: 'ep-2',
          title: 'E2',
          audioUrl: 'u',
          pubDate: new Date(),
          played: false,
        },
        {
          podcastId: podcast.id,
          guid: 'ep-3',
          title: 'E3',
          audioUrl: 'u',
          pubDate: new Date(),
          played: true,
        },
      ],
    });

    const body = await (await GET()).json();
    expect(body[0]._count.episodes).toBe(2); // only unplayed
  });
});
