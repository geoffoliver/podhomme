jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));
jest.mock('@/lib/download', () => ({ downloadEpisode: jest.fn() }));
jest.mock('@/lib/feed');

import { db } from '@/lib/db';
import { refreshPodcast } from '@/lib/refresh';
import { parseFeed } from '@/lib/feed';
import { broadcast } from '@/lib/sse';

const mockParseFeed = parseFeed as jest.MockedFunction<typeof parseFeed>;

const recentDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday

const feedEpisode = {
  guid: 'ep-001',
  title: 'Episode 1',
  description: null,
  audioUrl: 'https://cdn.example.com/ep1.mp3',
  mediaType: 'audio',
  imageUrl: null,
  duration: 3600,
  pubDate: recentDate,
};

describe('refreshPodcast', () => {
  let podcastId: number;

  beforeEach(async () => {
    const podcast = await db.podcast.create({
      data: {
        title: 'Test Podcast',
        feedUrl: 'https://feeds.example.com/test.rss',
      },
    });
    podcastId = podcast.id;

    mockParseFeed.mockResolvedValue({
      title: 'Test Podcast',
      description: null,
      imageUrl: null,
      siteUrl: null,
      author: null,
      type: 'episodic',
      episodes: [feedEpisode],
    });
  });

  it('updates the podcast metadata after fetching the feed', async () => {
    await refreshPodcast(podcastId);

    const podcast = await db.podcast.findUnique({ where: { id: podcastId } });
    expect(podcast?.title).toBe('Test Podcast');
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
        title: 'Episode 1',
        audioUrl: 'https://cdn.example.com/ep1.mp3',
        pubDate: recentDate,
      },
    });

    await refreshPodcast(podcastId);

    const episodes = await db.episode.findMany({ where: { podcastId } });
    expect(episodes).toHaveLength(1);
  });
});
