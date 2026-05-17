jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));
jest.mock('@/lib/feed');

import { POST } from '@/app/api/podcasts/route';
import { db } from '@/lib/db';
import { parseFeed } from '@/lib/feed';
import { broadcast } from '@/lib/sse';

const mockParseFeed = parseFeed as jest.MockedFunction<typeof parseFeed>;
const mockBroadcast = broadcast as jest.MockedFunction<typeof broadcast>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FEED_URL = 'https://feeds.example.com/test.rss';

function post(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/podcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function makeFeedEpisode(overrides: Partial<{ guid: string; pubDate: Date }> = {}) {
  return {
    guid: overrides.guid ?? 'ep-001',
    title: 'Episode',
    description: null,
    audioUrl: 'https://cdn.example.com/ep.mp3',
    mediaType: 'audio',
    imageUrl: null,
    duration: 3600,
    pubDate: overrides.pubDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
  };
}

const baseFeed = {
  title: 'Test Podcast',
  description: 'A test podcast',
  imageUrl: 'https://example.com/art.jpg',
  siteUrl: 'https://example.com',
  author: 'Test Author',
  type: 'episodic',
  episodes: [] as ReturnType<typeof makeFeedEpisode>[],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/podcasts', () => {
  beforeEach(() => {
    mockParseFeed.mockReset();
    mockBroadcast.mockClear();
    mockParseFeed.mockResolvedValue({ ...baseFeed, episodes: [] });
  });

  // ── validation ─────────────────────────────────────────────────────────────

  it('returns 400 when feedUrl is missing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when feedUrl is not a string', async () => {
    const res = await post({ feedUrl: 42 });
    expect(res.status).toBe(400);
  });

  // ── duplicate ──────────────────────────────────────────────────────────────

  it('returns 409 when already subscribed to the feed', async () => {
    await db.podcast.create({ data: { title: 'Existing', feedUrl: FEED_URL } });

    const res = await post({ feedUrl: FEED_URL });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already subscribed/i);
  });

  // ── feed parse error ───────────────────────────────────────────────────────

  it('returns 422 when the feed cannot be parsed', async () => {
    mockParseFeed.mockRejectedValue(new Error('Network error'));

    const res = await post({ feedUrl: FEED_URL });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  it('creates the podcast with metadata from the feed', async () => {
    const res = await post({ feedUrl: FEED_URL });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Test Podcast');
    expect(body.description).toBe('A test podcast');
    expect(body.author).toBe('Test Author');
    expect(body.feedUrl).toBe(FEED_URL);
    expect(body.lastRefreshedAt).not.toBeNull();
  });

  it('persists the podcast to the database', async () => {
    await post({ feedUrl: FEED_URL });

    const podcast = await db.podcast.findUnique({ where: { feedUrl: FEED_URL } });
    expect(podcast).not.toBeNull();
    expect(podcast?.title).toBe('Test Podcast');
  });

  it('broadcasts the podcast event', async () => {
    await post({ feedUrl: FEED_URL });
    expect(mockBroadcast).toHaveBeenCalledWith('podcast', expect.anything());
  });

  // ── episode seeding ────────────────────────────────────────────────────────

  it('creates no episodes when the feed is empty', async () => {
    await post({ feedUrl: FEED_URL });
    expect(await db.episode.count()).toBe(0);
  });

  it('seeds all episodes from the feed', async () => {
    mockParseFeed.mockResolvedValue({
      ...baseFeed,
      episodes: [
        makeFeedEpisode({ guid: 'ep-new', pubDate: new Date(Date.now() - 24 * 60 * 60 * 1000) }),
        makeFeedEpisode({ guid: 'ep-old', pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
      ],
    });

    await post({ feedUrl: FEED_URL });

    expect(await db.episode.count()).toBe(2);
  });

  it('marks only the first (newest) episode as unplayed', async () => {
    mockParseFeed.mockResolvedValue({
      ...baseFeed,
      episodes: [
        makeFeedEpisode({ guid: 'ep-new', pubDate: new Date(Date.now() - 24 * 60 * 60 * 1000) }),
        makeFeedEpisode({ guid: 'ep-old', pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
      ],
    });

    await post({ feedUrl: FEED_URL });

    const episodes = await db.episode.findMany({ orderBy: { pubDate: 'desc' } });
    expect(episodes[0].played).toBe(false); // newest
    expect(episodes[1].played).toBe(true);  // older
  });

  it('adds only the newest episode to the queue', async () => {
    mockParseFeed.mockResolvedValue({
      ...baseFeed,
      episodes: [
        makeFeedEpisode({ guid: 'ep-new', pubDate: new Date(Date.now() - 24 * 60 * 60 * 1000) }),
        makeFeedEpisode({ guid: 'ep-old', pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
      ],
    });

    await post({ feedUrl: FEED_URL });

    const queue = await db.queueItem.findMany({ include: { episode: true } });
    expect(queue).toHaveLength(1);
    expect(queue[0].episode.guid).toBe('ep-new');
  });

  it('queues the new episode after any existing queue items', async () => {
    // An existing podcast already has an episode at position 0
    const existingPod = await db.podcast.create({
      data: { title: 'Existing', feedUrl: 'https://feeds.example.com/other.rss' },
    });
    const existingEp = await db.episode.create({
      data: { podcastId: existingPod.id, guid: 'existing', title: 'E', audioUrl: 'u', pubDate: new Date() },
    });
    await db.queueItem.create({ data: { episodeId: existingEp.id, position: 0 } });

    mockParseFeed.mockResolvedValue({
      ...baseFeed,
      episodes: [makeFeedEpisode()],
    });

    await post({ feedUrl: FEED_URL });

    const newEpQueueItem = await db.queueItem.findFirst({
      where: { episode: { podcast: { feedUrl: FEED_URL } } },
    });
    expect(newEpQueueItem?.position).toBe(1);
  });

  // ── 60-day rule ────────────────────────────────────────────────────────────

  it('marks all episodes as played when the newest is over 60 days old', async () => {
    mockParseFeed.mockResolvedValue({
      ...baseFeed,
      episodes: [
        makeFeedEpisode({ pubDate: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000) }),
      ],
    });

    await post({ feedUrl: FEED_URL });

    const episode = await db.episode.findFirst();
    expect(episode?.played).toBe(true);
  });

  it('adds nothing to the queue when all episodes are over 60 days old', async () => {
    mockParseFeed.mockResolvedValue({
      ...baseFeed,
      episodes: [
        makeFeedEpisode({ pubDate: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000) }),
      ],
    });

    await post({ feedUrl: FEED_URL });

    expect(await db.queueItem.count()).toBe(0);
  });
});
