jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));
jest.mock('@/lib/download', () => ({ downloadEpisode: jest.fn() }));
jest.mock('@/lib/feed');
jest.mock('fs/promises', () => ({ rm: jest.fn() }));

import { db } from '@/lib/db';
import {
  refreshPodcast,
  refreshAll,
  startRefresh,
  __resetRefreshState,
} from '@/lib/refresh';
import { parseFeed } from '@/lib/feed';
import { broadcast } from '@/lib/sse';
import { downloadEpisode } from '@/lib/download';
import { rm } from 'fs/promises';

const mockParseFeed = parseFeed as jest.MockedFunction<typeof parseFeed>;
const mockBroadcast = broadcast as jest.MockedFunction<typeof broadcast>;
const mockDownloadEpisode = downloadEpisode as jest.MockedFunction<
  typeof downloadEpisode
>;
const mockRm = rm as jest.MockedFunction<typeof rm>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFeedEpisode(
  overrides: Partial<{
    guid: string;
    pubDate: Date;
    title: string;
  }> = {},
) {
  return {
    guid: overrides.guid ?? 'ep-001',
    title: overrides.title ?? 'Episode 1',
    description: null,
    audioUrl: 'https://cdn.example.com/ep.mp3',
    mediaType: 'audio',
    imageUrl: null,
    duration: 3600,
    pubDate: overrides.pubDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
  };
}

function makeFeed(episodes: ReturnType<typeof makeFeedEpisode>[]) {
  return {
    title: 'Test Podcast',
    description: null,
    imageUrl: null,
    siteUrl: null,
    author: null,
    type: 'episodic',
    episodes,
  };
}

function makeFullFeedResult(
  feed: ReturnType<typeof makeFeed>,
  etag: string | null = null,
  lastModified: string | null = null,
) {
  return { notModified: false as const, feed, etag, lastModified };
}

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000);
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const SIXTY_ONE_DAYS_AGO = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);

// ─── refreshPodcast ───────────────────────────────────────────────────────────

describe('refreshPodcast', () => {
  let podcastId: number;

  beforeEach(async () => {
    mockParseFeed.mockReset();
    mockBroadcast.mockClear();
    const podcast = await db.podcast.create({
      data: {
        title: 'Test Podcast',
        feedUrl: 'https://feeds.example.com/test.rss',
      },
    });
    podcastId = podcast.id;
    mockParseFeed.mockResolvedValue(
      makeFullFeedResult(makeFeed([makeFeedEpisode()])),
    );
  });

  // ── existing coverage (kept for regression) ────────────────────────────────

  it('updates the podcast metadata after fetching the feed', async () => {
    await refreshPodcast(podcastId);
    const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
    expect(podcast?.lastRefreshedAt).not.toBeNull();
  });

  it('creates new episodes found in the feed', async () => {
    await refreshPodcast(podcastId);
    const episodes = await db.episode.findMany({ where: { podcastId } });
    expect(episodes).toHaveLength(1);
    expect(episodes[0].guid).toBe('ep-001');
  });

  it('adds the newest episode to the queue', async () => {
    await refreshPodcast(podcastId);
    const queue = await db.queueItem.findMany({ include: { episode: true } });
    expect(queue).toHaveLength(1);
    expect(queue[0].episode.guid).toBe('ep-001');
  });

  it('broadcasts a podcast event after refresh', async () => {
    await refreshPodcast(podcastId);
    expect(broadcast).toHaveBeenCalledWith('podcast', expect.anything());
  });

  it('skips episodes that already exist in the database', async () => {
    await db.episode.create({
      data: {
        podcastId,
        guid: 'ep-001',
        title: 'E1',
        audioUrl: 'u',
        pubDate: YESTERDAY,
      },
    });
    await refreshPodcast(podcastId);
    expect(await db.episode.count({ where: { podcastId } })).toBe(1);
  });

  // ── conditional HTTP caching ───────────────────────────────────────────────

  describe('conditional HTTP caching', () => {
    it('passes cached etag and lastModified to parseFeed', async () => {
      await db.podcast.update({
        where: { id: podcastId },
        data: { lastEtag: '"abc123"', lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT' },
      });
      await refreshPodcast(podcastId);
      expect(mockParseFeed).toHaveBeenCalledWith(
        expect.any(String),
        { etag: '"abc123"', lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT' },
      );
    });

    it('stores etag and lastModified returned by parseFeed', async () => {
      mockParseFeed.mockResolvedValue(
        makeFullFeedResult(makeFeed([]), '"new-etag"', 'Thu, 02 Jan 2025 00:00:00 GMT'),
      );
      await refreshPodcast(podcastId);
      const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
      expect(podcast?.lastEtag).toBe('"new-etag"');
      expect(podcast?.lastModified).toBe('Thu, 02 Jan 2025 00:00:00 GMT');
    });

    it('skips all processing and does not broadcast when parseFeed returns notModified', async () => {
      mockParseFeed.mockResolvedValue({ notModified: true });
      await refreshPodcast(podcastId);
      expect(mockBroadcast).not.toHaveBeenCalled();
      // lastRefreshedAt should not be updated
      const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
      expect(podcast?.lastRefreshedAt).toBeNull();
    });

    it('does not create episodes when parseFeed returns notModified', async () => {
      mockParseFeed.mockResolvedValue({ notModified: true });
      await refreshPodcast(podcastId);
      expect(await db.episode.count({ where: { podcastId } })).toBe(0);
    });
  });

  // ── multiple new episodes ──────────────────────────────────────────────────

  describe('when the feed contains multiple new episodes', () => {
    beforeEach(() => {
      mockParseFeed.mockResolvedValue(
        makeFullFeedResult(makeFeed([
          makeFeedEpisode({ guid: 'ep-new', pubDate: YESTERDAY }), // newer
          makeFeedEpisode({ guid: 'ep-old', pubDate: TWO_DAYS_AGO }), // older
        ])),
      );
    });

    it('only queues the single newest episode', async () => {
      await refreshPodcast(podcastId);
      const queue = await db.queueItem.findMany({ include: { episode: true } });
      expect(queue).toHaveLength(1);
      expect(queue[0].episode.guid).toBe('ep-new');
    });

    it('marks older new episodes as played immediately', async () => {
      await refreshPodcast(podcastId);
      const older = await db.episode.findFirst({
        where: { podcastId, guid: 'ep-old' },
      });
      expect(older?.played).toBe(true);
    });
  });

  // ── 60-day rule ────────────────────────────────────────────────────────────

  describe('60-day rule', () => {
    beforeEach(() => {
      mockParseFeed.mockResolvedValue(
        makeFullFeedResult(makeFeed([makeFeedEpisode({ pubDate: SIXTY_ONE_DAYS_AGO })])),
      );
    });

    it('marks all new episodes as played when the newest is over 60 days old', async () => {
      await refreshPodcast(podcastId);
      const episodes = await db.episode.findMany({ where: { podcastId } });
      expect(episodes).toHaveLength(1);
      expect(episodes[0].played).toBe(true);
    });

    it('does not add any episodes to the queue when newest is over 60 days old', async () => {
      await refreshPodcast(podcastId);
      expect(await db.queueItem.count()).toBe(0);
    });
  });

  // ── reappearing pruned episodes ────────────────────────────────────────────

  describe('reappearing pruned episode', () => {
    it('creates the episode as played when its pubDate is older than the most recent stored episode', async () => {
      await db.episode.create({
        data: {
          podcastId,
          guid: 'ep-stored',
          title: 'Stored',
          audioUrl: 'u',
          pubDate: YESTERDAY,
        },
      });

      mockParseFeed.mockResolvedValue(
        makeFullFeedResult(makeFeed([
          makeFeedEpisode({ guid: 'ep-pruned', pubDate: TWO_DAYS_AGO }),
        ])),
      );

      await refreshPodcast(podcastId);

      const pruned = await db.episode.findFirst({
        where: { podcastId, guid: 'ep-pruned' },
      });
      expect(pruned?.played).toBe(true);
    });

    it('does not add a reappearing pruned episode to the queue', async () => {
      await db.episode.create({
        data: {
          podcastId,
          guid: 'ep-stored',
          title: 'Stored',
          audioUrl: 'u',
          pubDate: YESTERDAY,
        },
      });

      mockParseFeed.mockResolvedValue(
        makeFullFeedResult(makeFeed([
          makeFeedEpisode({ guid: 'ep-pruned', pubDate: TWO_DAYS_AGO }),
        ])),
      );

      await refreshPodcast(podcastId);

      const queue = await db.queueItem.findMany({ include: { episode: true } });
      expect(queue.every((q) => q.episode.guid !== 'ep-pruned')).toBe(true);
    });
  });

  // ── pruning ────────────────────────────────────────────────────────────────

  describe('pruning', () => {
    beforeEach(() => {
      mockRm.mockReset();
      mockRm.mockResolvedValue(undefined);
      // No new episodes so pruning logic runs against pre-existing data only
      mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));
    });

    it('skips pruning when defaultPlayback is stream (default)', async () => {
      await db.episode.create({
        data: {
          podcastId,
          guid: 'ep-dl',
          title: 'Downloaded',
          audioUrl: 'u',
          pubDate: YESTERDAY,
          downloadPath: '/downloads/ep.mp3',
        },
      });
      await refreshPodcast(podcastId);
      expect(mockRm).not.toHaveBeenCalled();
    });

    it('skips pruning when episodesToKeep is "all"', async () => {
      await db.settings.update({
        where: { id: 1 },
        data: { defaultPlayback: 'download', episodesToKeep: 'all' },
      });
      await db.episode.create({
        data: {
          podcastId,
          guid: 'ep-dl',
          title: 'Downloaded',
          audioUrl: 'u',
          pubDate: YESTERDAY,
          downloadPath: '/downloads/ep.mp3',
        },
      });
      await refreshPodcast(podcastId);
      expect(mockRm).not.toHaveBeenCalled();
    });

    it('triggers downloadEpisode for the newest episode when defaultPlayback is "download"', async () => {
      await db.settings.update({
        where: { id: 1 },
        data: { defaultPlayback: 'download', episodesToKeep: 'all' },
      });
      mockParseFeed.mockResolvedValue(
        makeFullFeedResult(makeFeed([makeFeedEpisode({ guid: 'ep-new' })])),
      );

      await refreshPodcast(podcastId);

      const episode = await db.episode.findFirst({ where: { podcastId } });
      expect(mockDownloadEpisode).toHaveBeenCalledWith(
        episode!.id,
        episode!.audioUrl,
        expect.any(String),
      );
    });

    describe('numeric episodesToKeep limit', () => {
      beforeEach(async () => {
        await db.settings.update({
          where: { id: 1 },
          data: { defaultPlayback: 'download', episodesToKeep: '1' },
        });
        // Three episodes with download paths; ordered oldest→newest
        await db.episode.createMany({
          data: [
            {
              podcastId,
              guid: 'ep-a',
              title: 'A',
              audioUrl: 'u',
              pubDate: new Date('2024-01-01'),
              downloadPath: '/dl/a.mp3',
            },
            {
              podcastId,
              guid: 'ep-b',
              title: 'B',
              audioUrl: 'u',
              pubDate: new Date('2024-02-01'),
              downloadPath: '/dl/b.mp3',
            },
            {
              podcastId,
              guid: 'ep-c',
              title: 'C',
              audioUrl: 'u',
              pubDate: new Date('2024-03-01'),
              downloadPath: '/dl/c.mp3',
            },
          ],
        });
      });

      it('deletes download files for episodes beyond the limit', async () => {
        await refreshPodcast(podcastId);
        // Keep only the newest (ep-c); delete ep-a and ep-b
        expect(mockRm).toHaveBeenCalledTimes(2);
        expect(mockRm).toHaveBeenCalledWith('/dl/a.mp3', { force: true });
        expect(mockRm).toHaveBeenCalledWith('/dl/b.mp3', { force: true });
      });

      it('clears downloadPath in the database for pruned episodes', async () => {
        await refreshPodcast(podcastId);
        const epA = await db.episode.findFirst({
          where: { podcastId, guid: 'ep-a' },
        });
        const epB = await db.episode.findFirst({
          where: { podcastId, guid: 'ep-b' },
        });
        const epC = await db.episode.findFirst({
          where: { podcastId, guid: 'ep-c' },
        });
        expect(epA?.downloadPath).toBeNull();
        expect(epB?.downloadPath).toBeNull();
        expect(epC?.downloadPath).toBe('/dl/c.mp3'); // newest kept
      });

      it('continues pruning remaining episodes when rm fails for one', async () => {
        mockRm
          .mockRejectedValueOnce(new Error('EACCES'))
          .mockResolvedValue(undefined);
        await expect(refreshPodcast(podcastId)).resolves.not.toThrow();
        // Second episode should still have been attempted
        expect(mockRm).toHaveBeenCalledTimes(2);
      });
    });

    describe('episodesToKeep: "all_unplayed"', () => {
      beforeEach(async () => {
        await db.settings.update({
          where: { id: 1 },
          data: { defaultPlayback: 'download', episodesToKeep: 'all_unplayed' },
        });
        await db.episode.createMany({
          data: [
            // played + downloaded → should be pruned
            {
              podcastId,
              guid: 'ep-played',
              title: 'Played',
              audioUrl: 'u',
              pubDate: TWO_DAYS_AGO,
              played: true,
              downloadPath: '/dl/played.mp3',
            },
            // unplayed + downloaded → should be kept
            {
              podcastId,
              guid: 'ep-unplayed',
              title: 'Unplayed',
              audioUrl: 'u',
              pubDate: YESTERDAY,
              played: false,
              downloadPath: '/dl/unplayed.mp3',
            },
          ],
        });
      });

      it('deletes download files only for played episodes', async () => {
        await refreshPodcast(podcastId);
        expect(mockRm).toHaveBeenCalledTimes(1);
        expect(mockRm).toHaveBeenCalledWith('/dl/played.mp3', { force: true });
      });

      it('preserves download files for unplayed episodes', async () => {
        await refreshPodcast(podcastId);
        const unplayed = await db.episode.findFirst({
          where: { podcastId, guid: 'ep-unplayed' },
        });
        expect(unplayed?.downloadPath).toBe('/dl/unplayed.mp3');
      });

      it('clears downloadPath in the database for pruned played episodes', async () => {
        await refreshPodcast(podcastId);
        const played = await db.episode.findFirst({
          where: { podcastId, guid: 'ep-played' },
        });
        expect(played?.downloadPath).toBeNull();
      });

      it('continues when rm fails for a played episode', async () => {
        mockRm.mockRejectedValueOnce(new Error('ENOENT'));
        await expect(refreshPodcast(podcastId)).resolves.not.toThrow();
      });
    });
  });
});

// ─── refreshAll ───────────────────────────────────────────────────────────────

describe('refreshAll', () => {
  beforeEach(async () => {
    mockParseFeed.mockReset();
    mockBroadcast.mockClear();
  });

  it('refreshes all subscribed podcasts', async () => {
    await db.podcast.createMany({
      data: [
        { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' },
        { title: 'Podcast B', feedUrl: 'https://feeds.example.com/b.rss' },
      ],
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    await refreshAll();

    expect(mockParseFeed).toHaveBeenCalledTimes(2);
  });

  it('continues refreshing remaining podcasts when one fails', async () => {
    const [, podB] = await Promise.all([
      db.podcast.create({
        data: {
          title: 'Podcast A',
          feedUrl: 'https://feeds.example.com/a.rss',
        },
      }),
      db.podcast.create({
        data: {
          title: 'Podcast B',
          feedUrl: 'https://feeds.example.com/b.rss',
        },
      }),
    ]);

    mockParseFeed
      .mockRejectedValueOnce(new Error('Feed fetch failed'))
      .mockResolvedValueOnce(
        makeFullFeedResult(makeFeed([makeFeedEpisode({ guid: 'ep-b' })])),
      );

    await refreshAll();

    const bEpisodes = await db.episode.findMany({
      where: { podcastId: podB.id },
    });
    expect(bEpisodes).toHaveLength(1);
    expect(bEpisodes[0].guid).toBe('ep-b');
  });

  it('broadcasts a done event after all podcasts have been processed', async () => {
    await db.podcast.create({
      data: { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' },
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    await refreshAll();

    expect(mockBroadcast).toHaveBeenLastCalledWith('refresh', { done: true });
  });

  it('broadcasts per-podcast progress events', async () => {
    await db.podcast.createMany({
      data: [
        { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' },
        { title: 'Podcast B', feedUrl: 'https://feeds.example.com/b.rss' },
      ],
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    await refreshAll();

    const refreshCalls = mockBroadcast.mock.calls.filter(
      ([event]) => event === 'refresh',
    );
    const progressCalls = refreshCalls.filter(
      ([, data]) => !(data as any).done,
    );
    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0][1]).toMatchObject({
      current: 1,
      total: 2,
      done: false,
    });
    expect(progressCalls[1][1]).toMatchObject({
      current: 2,
      total: 2,
      done: false,
    });
  });

  it('invokes the optional onProgress callback for each podcast', async () => {
    await db.podcast.createMany({
      data: [
        { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' },
        { title: 'Podcast B', feedUrl: 'https://feeds.example.com/b.rss' },
      ],
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    const onProgress = jest.fn();
    await refreshAll(onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, expect.any(String), 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, expect.any(String), 2, 2);
  });

  it('does not run concurrently when called while already refreshing', async () => {
    await db.podcast.create({
      data: { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' },
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    // Both calls start in the same tick; p1 sets isRefreshing=true synchronously
    // before any await, so p2 sees it and returns immediately
    const p1 = refreshAll();
    const p2 = refreshAll();
    await Promise.all([p1, p2]);

    expect(mockParseFeed).toHaveBeenCalledTimes(1);
  });
});

// ─── startRefresh ─────────────────────────────────────────────────────────────

describe('startRefresh', () => {
  beforeEach(() => {
    mockParseFeed.mockReset();
    mockBroadcast.mockClear();
    __resetRefreshState();
  });

  it('returns { started: true } and fires a refresh on first call', async () => {
    await db.podcast.create({
      data: { title: 'P', feedUrl: 'https://feeds.example.com/p.rss' },
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    const result = await startRefresh();
    expect(result).toEqual({ started: true });

    // Let the background refresh complete
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockParseFeed).toHaveBeenCalledTimes(1);
  });

  it('returns already_running when a refresh is in progress', async () => {
    await db.podcast.create({
      data: { title: 'P', feedUrl: 'https://feeds.example.com/p.rss' },
    });
    let resolveRefresh!: () => void;
    mockParseFeed.mockImplementation(
      () =>
        new Promise<ReturnType<typeof makeFullFeedResult>>((resolve) => {
          resolveRefresh = () => resolve(makeFullFeedResult(makeFeed([])));
        }),
    );

    const first = startRefresh();
    // Give the background refresh time to start and set isRefreshing
    await new Promise((resolve) => setImmediate(resolve));

    const second = await startRefresh();
    expect(second).toEqual({ skipped: true, reason: 'already_running' });

    resolveRefresh();
    await first;
  });

  it('returns too_soon when called within the refresh frequency window', async () => {
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    // First call succeeds and records lastRefreshedAt
    await startRefresh();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Second call immediately after — within any reasonable frequency window
    const result = await startRefresh();
    expect(result).toMatchObject({ skipped: true, reason: 'too_soon' });
    expect((result as { nextRefreshIn: number }).nextRefreshIn).toBeGreaterThan(
      0,
    );
  });

  it('force=true bypasses the too_soon guard', async () => {
    await db.podcast.create({
      data: { title: 'P', feedUrl: 'https://feeds.example.com/p.rss' },
    });
    mockParseFeed.mockResolvedValue(makeFullFeedResult(makeFeed([])));

    await startRefresh();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const result = await startRefresh(true);
    expect(result).toEqual({ started: true });
  });
});
