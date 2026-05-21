jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));
jest.mock('@/lib/feed', () => ({
  ...jest.requireActual('@/lib/feed'), // keep real parseOpml
  parseFeed: jest.fn(),
}));

import { POST } from '@/app/api/import/opml/route';
import { broadcast } from '@/lib/sse';
import { db } from '@/lib/db';
import { parseFeed } from '@/lib/feed';

const mockParseFeed = parseFeed as jest.MockedFunction<typeof parseFeed>;
const mockBroadcast = broadcast as jest.MockedFunction<typeof broadcast>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOpml(...feeds: { title: string; url: string }[]) {
  const outlines = feeds
    .map(
      ({ title, url }) =>
        `<outline text="${title}" title="${title}" type="rss" xmlUrl="${url}"/>`,
    )
    .join('');
  return `<?xml version="1.0"?><opml version="2.0"><body>${outlines}</body></opml>`;
}

function post(xml: string) {
  const fd = new FormData();
  fd.set('file', new Blob([xml], { type: 'text/xml' }), 'import.opml');
  return POST(
    new Request('http://localhost/api/import/opml', {
      method: 'POST',
      body: fd,
    }),
  );
}

function postNoFile() {
  return POST(
    new Request('http://localhost/api/import/opml', {
      method: 'POST',
      body: new FormData(),
    }),
  );
}

const baseFeed = {
  title: 'My Podcast',
  description: null,
  imageUrl: null,
  siteUrl: null,
  author: null,
  type: 'episodic',
  episodes: [] as any[],
};

function feedResult(overrides: Partial<typeof baseFeed> = {}) {
  return {
    notModified: false as const,
    feed: { ...baseFeed, ...overrides },
    etag: null,
    lastModified: null,
  };
}

const FEED_A = 'https://feeds.example.com/a.rss';
const FEED_B = 'https://feeds.example.com/b.rss';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/import/opml', () => {
  beforeEach(() => {
    mockParseFeed.mockReset();
    mockBroadcast.mockClear();
    mockParseFeed.mockResolvedValue(feedResult({ title: 'Imported Podcast' }));
  });

  // ── validation ─────────────────────────────────────────────────────────────

  it('returns 400 when no file is provided', async () => {
    const res = await postNoFile();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 422 when the OPML contains no feeds', async () => {
    const emptyOpml =
      '<?xml version="1.0"?><opml version="2.0"><body></body></opml>';
    const res = await post(emptyOpml);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ── single feed ────────────────────────────────────────────────────────────

  it('creates the podcast in the database', async () => {
    await post(makeOpml({ title: 'My Podcast', url: FEED_A }));

    const podcast = await db.podcast.findUnique({ where: { feedUrl: FEED_A } });
    expect(podcast).not.toBeNull();
    expect(podcast?.title).toBe('Imported Podcast');
  });

  it('returns status "added" for a successfully imported feed', async () => {
    const res = await post(makeOpml({ title: 'My Podcast', url: FEED_A }));
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({ feedUrl: FEED_A, status: 'added' });
  });

  it('broadcasts the podcast event for each added feed', async () => {
    await post(makeOpml({ title: 'My Podcast', url: FEED_A }));
    expect(mockBroadcast).toHaveBeenCalledWith('podcast', expect.anything());
  });

  // ── already subscribed ─────────────────────────────────────────────────────

  it('returns status "exists" for feeds already subscribed', async () => {
    await db.podcast.create({ data: { title: 'Existing', feedUrl: FEED_A } });

    const res = await post(makeOpml({ title: 'My Podcast', url: FEED_A }));
    const body = await res.json();

    expect(body.results[0]).toMatchObject({
      feedUrl: FEED_A,
      status: 'exists',
    });
  });

  it('does not call parseFeed for already-subscribed feeds', async () => {
    await db.podcast.create({ data: { title: 'Existing', feedUrl: FEED_A } });

    await post(makeOpml({ title: 'My Podcast', url: FEED_A }));

    expect(mockParseFeed).not.toHaveBeenCalled();
  });

  it('does not create a duplicate podcast record', async () => {
    await db.podcast.create({ data: { title: 'Existing', feedUrl: FEED_A } });

    await post(makeOpml({ title: 'My Podcast', url: FEED_A }));

    expect(await db.podcast.count({ where: { feedUrl: FEED_A } })).toBe(1);
  });

  // ── error isolation ────────────────────────────────────────────────────────

  it('continues importing remaining feeds when one fails', async () => {
    mockParseFeed
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(feedResult({ title: 'Podcast B' }));

    await post(
      makeOpml(
        { title: 'Feed A', url: FEED_A },
        { title: 'Feed B', url: FEED_B },
      ),
    );

    const podB = await db.podcast.findUnique({ where: { feedUrl: FEED_B } });
    expect(podB).not.toBeNull();
  });

  it('returns status "error" for a feed that fails to parse', async () => {
    mockParseFeed
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(feedResult({ title: 'Podcast B' }));

    const res = await post(
      makeOpml(
        { title: 'Feed A', url: FEED_A },
        { title: 'Feed B', url: FEED_B },
      ),
    );
    const body = await res.json();

    expect(body.results.find((r: any) => r.feedUrl === FEED_A)?.status).toBe(
      'error',
    );
    expect(body.results.find((r: any) => r.feedUrl === FEED_B)?.status).toBe(
      'added',
    );
  });

  // ── multiple feeds ─────────────────────────────────────────────────────────

  it('processes all feeds and returns a result for each', async () => {
    mockParseFeed
      .mockResolvedValueOnce(feedResult({ title: 'Podcast A' }))
      .mockResolvedValueOnce(feedResult({ title: 'Podcast B' }));

    const res = await post(
      makeOpml(
        { title: 'Feed A', url: FEED_A },
        { title: 'Feed B', url: FEED_B },
      ),
    );
    const body = await res.json();

    expect(body.results).toHaveLength(2);
    expect(await db.podcast.count()).toBe(2);
  });

  // ── episode seeding ────────────────────────────────────────────────────────

  it('seeds episodes from the feed', async () => {
    mockParseFeed.mockResolvedValue(
      feedResult({
        episodes: [
          {
            guid: 'ep-1',
            title: 'Ep 1',
            description: null,
            audioUrl: 'u',
            mediaType: 'audio',
            imageUrl: null,
            duration: null,
            pubDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            guid: 'ep-2',
            title: 'Ep 2',
            description: null,
            audioUrl: 'u',
            mediaType: 'audio',
            imageUrl: null,
            duration: null,
            pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
      }),
    );

    await post(makeOpml({ title: 'My Podcast', url: FEED_A }));

    expect(await db.episode.count()).toBe(2);
  });

  it('queues only the newest episode', async () => {
    mockParseFeed.mockResolvedValue(
      feedResult({
        episodes: [
          {
            guid: 'ep-new',
            title: 'New',
            description: null,
            audioUrl: 'u',
            mediaType: 'audio',
            imageUrl: null,
            duration: null,
            pubDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            guid: 'ep-old',
            title: 'Old',
            description: null,
            audioUrl: 'u',
            mediaType: 'audio',
            imageUrl: null,
            duration: null,
            pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
      }),
    );

    await post(makeOpml({ title: 'My Podcast', url: FEED_A }));

    const queue = await db.queueItem.findMany({ include: { episode: true } });
    expect(queue).toHaveLength(1);
    expect(queue[0].episode.guid).toBe('ep-new');
  });
});
