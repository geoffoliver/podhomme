import { db } from '@/lib/db';
import { getNextEpisode, getPrevEpisode } from '@/lib/playback';

let podcastSeq = 0;

// Shared episode creation helper
async function seedPodcastAndEpisodes(overrides: { type?: string; typeOverride?: string } = {}) {
  const n = ++podcastSeq;
  const podcast = await db.podcast.create({
    data: {
      title: 'Test Podcast',
      feedUrl: `https://feeds.example.com/test-${n}.rss`,
      type: overrides.type ?? 'episodic',
      typeOverride: overrides.typeOverride ?? null,
    },
  });

  // Three episodes ordered oldest → newest by pubDate
  const ep1 = await db.episode.create({
    data: {
      podcastId: podcast.id,
      guid: 'ep-001',
      title: 'Episode 1 (oldest)',
      audioUrl: 'https://cdn.example.com/ep1.mp3',
      pubDate: new Date('2024-01-01'),
    },
  });
  const ep2 = await db.episode.create({
    data: {
      podcastId: podcast.id,
      guid: 'ep-002',
      title: 'Episode 2 (middle)',
      audioUrl: 'https://cdn.example.com/ep2.mp3',
      pubDate: new Date('2024-02-01'),
    },
  });
  const ep3 = await db.episode.create({
    data: {
      podcastId: podcast.id,
      guid: 'ep-003',
      title: 'Episode 3 (newest)',
      audioUrl: 'https://cdn.example.com/ep3.mp3',
      pubDate: new Date('2024-03-01'),
    },
  });

  return { podcast, ep1, ep2, ep3 };
}

// ─── getNextEpisode ───────────────────────────────────────────────────────────

describe('getNextEpisode', () => {
  describe('all context', () => {
    let ep1Id: number, ep2Id: number, ep3Id: number, ep4Id: number;

    beforeEach(async () => {
      const { podcast, ep1, ep2, ep3 } = await seedPodcastAndEpisodes();
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;

      // Fourth episode, not in queue
      const ep4 = await db.episode.create({
        data: {
          podcastId: podcast.id,
          guid: 'ep-004',
          title: 'Episode 4 (no queue)',
          audioUrl: 'https://cdn.example.com/ep4.mp3',
          pubDate: new Date('2024-04-01'),
        },
      });
      ep4Id = ep4.id;

      await db.queueItem.createMany({
        data: [
          { episodeId: ep1Id, position: 0 },
          { episodeId: ep2Id, position: 1 },
          { episodeId: ep3Id, position: 2 },
        ],
      });
    });

    it('returns the next episode by queue position', async () => {
      expect(await getNextEpisode(ep1Id, 'all', null)).toBe(ep2Id);
      expect(await getNextEpisode(ep2Id, 'all', null)).toBe(ep3Id);
    });

    it('returns null at the end of the queue', async () => {
      expect(await getNextEpisode(ep3Id, 'all', null)).toBeNull();
    });

    it('returns null when the current episode is not in the queue', async () => {
      expect(await getNextEpisode(ep4Id, 'all', null)).toBeNull();
    });
  });

  describe('podcast context — episodic (newest→oldest)', () => {
    let podcastId: number;
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { podcast, ep1, ep2, ep3 } = await seedPodcastAndEpisodes({ type: 'episodic' });
      podcastId = podcast.id;
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;
    });

    it('returns the next older episode', async () => {
      // Playing newest (ep3) → next is ep2
      expect(await getNextEpisode(ep3Id, 'podcast', podcastId)).toBe(ep2Id);
      // Playing middle (ep2) → next is ep1
      expect(await getNextEpisode(ep2Id, 'podcast', podcastId)).toBe(ep1Id);
    });

    it('returns null when already at the oldest episode', async () => {
      expect(await getNextEpisode(ep1Id, 'podcast', podcastId)).toBeNull();
    });
  });

  describe('podcast context — serial (oldest→newest)', () => {
    let podcastId: number;
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { podcast, ep1, ep2, ep3 } = await seedPodcastAndEpisodes({ type: 'serial' });
      podcastId = podcast.id;
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;
    });

    it('returns the next newer episode', async () => {
      // Playing oldest (ep1) → next is ep2
      expect(await getNextEpisode(ep1Id, 'podcast', podcastId)).toBe(ep2Id);
      // Playing middle (ep2) → next is ep3
      expect(await getNextEpisode(ep2Id, 'podcast', podcastId)).toBe(ep3Id);
    });

    it('returns null when already at the newest episode', async () => {
      expect(await getNextEpisode(ep3Id, 'podcast', podcastId)).toBeNull();
    });
  });

  describe('podcast context — typeOverride takes precedence over type', () => {
    it('treats podcast as serial when typeOverride is serial even if type is episodic', async () => {
      const { podcast, ep1, ep2 } = await seedPodcastAndEpisodes({
        type: 'episodic',
        typeOverride: 'serial',
      });
      // Serial order: ep1 (oldest) → ep2; next after ep1 should be ep2
      expect(await getNextEpisode(ep1.id, 'podcast', podcast.id)).toBe(ep2.id);
    });

    it('treats podcast as episodic when typeOverride is episodic even if type is serial', async () => {
      const { podcast, ep2, ep3 } = await seedPodcastAndEpisodes({
        type: 'serial',
        typeOverride: 'episodic',
      });
      // Episodic order: ep3 (newest) → ep2; next after ep3 should be ep2
      expect(await getNextEpisode(ep3.id, 'podcast', podcast.id)).toBe(ep2.id);
    });
  });

  describe('podcast context — missing data', () => {
    it('returns null when contextPodcastId is null', async () => {
      const { ep1 } = await seedPodcastAndEpisodes();
      expect(await getNextEpisode(ep1.id, 'podcast', null)).toBeNull();
    });

    it('returns null when the current episode does not exist', async () => {
      const { podcast } = await seedPodcastAndEpisodes();
      expect(await getNextEpisode(999999, 'podcast', podcast.id)).toBeNull();
    });

    it('returns null when the podcast record does not exist', async () => {
      const { ep1 } = await seedPodcastAndEpisodes();
      expect(await getNextEpisode(ep1.id, 'podcast', 999999)).toBeNull();
    });
  });

  describe('favorites context', () => {
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { ep1, ep2, ep3 } = await seedPodcastAndEpisodes();
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;

      // Favorite all three with distinct timestamps; ep3 most recently favorited
      await db.episode.update({
        where: { id: ep1Id },
        data: { favorited: true, favoritedAt: new Date('2024-01-01T00:00:00Z') },
      });
      await db.episode.update({
        where: { id: ep2Id },
        data: { favorited: true, favoritedAt: new Date('2024-02-01T00:00:00Z') },
      });
      await db.episode.update({
        where: { id: ep3Id },
        data: { favorited: true, favoritedAt: new Date('2024-03-01T00:00:00Z') },
      });
    });

    it('returns the next episode in reverse-favorited order', async () => {
      // Favorites play newest-favorited first: ep3 → ep2 → ep1
      expect(await getNextEpisode(ep3Id, 'favorites', null)).toBe(ep2Id);
      expect(await getNextEpisode(ep2Id, 'favorites', null)).toBe(ep1Id);
    });

    it('returns null at the end of favorites', async () => {
      expect(await getNextEpisode(ep1Id, 'favorites', null)).toBeNull();
    });

    it('returns null when current episode is not favorited', async () => {
      const { podcast } = await seedPodcastAndEpisodes();
      const unfavorited = await db.episode.create({
        data: {
          podcastId: podcast.id,
          guid: 'ep-unfav',
          title: 'Not Favorited',
          audioUrl: 'https://cdn.example.com/unfav.mp3',
          pubDate: new Date(),
        },
      });
      expect(await getNextEpisode(unfavorited.id, 'favorites', null)).toBeNull();
    });
  });

  it('returns null for an unknown context', async () => {
    const { ep1 } = await seedPodcastAndEpisodes();
    expect(await getNextEpisode(ep1.id, 'unknown', null)).toBeNull();
  });
});

// ─── getPrevEpisode ───────────────────────────────────────────────────────────

describe('getPrevEpisode', () => {
  describe('all context', () => {
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { ep1, ep2, ep3 } = await seedPodcastAndEpisodes();
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;

      await db.queueItem.createMany({
        data: [
          { episodeId: ep1Id, position: 0 },
          { episodeId: ep2Id, position: 1 },
          { episodeId: ep3Id, position: 2 },
        ],
      });
    });

    it('returns the previous episode by queue position', async () => {
      expect(await getPrevEpisode(ep3Id, 'all', null)).toBe(ep2Id);
      expect(await getPrevEpisode(ep2Id, 'all', null)).toBe(ep1Id);
    });

    it('returns null at the start of the queue', async () => {
      expect(await getPrevEpisode(ep1Id, 'all', null)).toBeNull();
    });

    it('returns null when the current episode is not in the queue', async () => {
      const { podcast } = await seedPodcastAndEpisodes();
      const extra = await db.episode.create({
        data: {
          podcastId: podcast.id,
          guid: 'ep-extra',
          title: 'Extra',
          audioUrl: 'https://cdn.example.com/extra.mp3',
          pubDate: new Date(),
        },
      });
      expect(await getPrevEpisode(extra.id, 'all', null)).toBeNull();
    });
  });

  describe('podcast context — episodic (newest→oldest)', () => {
    let podcastId: number;
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { podcast, ep1, ep2, ep3 } = await seedPodcastAndEpisodes({ type: 'episodic' });
      podcastId = podcast.id;
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;
    });

    it('returns the previous (newer) episode', async () => {
      // Playing ep1 (oldest) → prev is ep2 (newer)
      expect(await getPrevEpisode(ep1Id, 'podcast', podcastId)).toBe(ep2Id);
      // Playing ep2 (middle) → prev is ep3 (newest)
      expect(await getPrevEpisode(ep2Id, 'podcast', podcastId)).toBe(ep3Id);
    });

    it('returns null when already at the newest episode', async () => {
      expect(await getPrevEpisode(ep3Id, 'podcast', podcastId)).toBeNull();
    });
  });

  describe('podcast context — serial (oldest→newest)', () => {
    let podcastId: number;
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { podcast, ep1, ep2, ep3 } = await seedPodcastAndEpisodes({ type: 'serial' });
      podcastId = podcast.id;
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;
    });

    it('returns the previous (older) episode', async () => {
      // Playing ep3 (newest) → prev is ep2
      expect(await getPrevEpisode(ep3Id, 'podcast', podcastId)).toBe(ep2Id);
      // Playing ep2 (middle) → prev is ep1
      expect(await getPrevEpisode(ep2Id, 'podcast', podcastId)).toBe(ep1Id);
    });

    it('returns null when already at the oldest episode', async () => {
      expect(await getPrevEpisode(ep1Id, 'podcast', podcastId)).toBeNull();
    });
  });

  describe('podcast context — typeOverride takes precedence over type', () => {
    it('treats podcast as serial when typeOverride is serial', async () => {
      const { podcast, ep2, ep3 } = await seedPodcastAndEpisodes({
        type: 'episodic',
        typeOverride: 'serial',
      });
      // Serial: prev before ep3 (newest) is ep2
      expect(await getPrevEpisode(ep3.id, 'podcast', podcast.id)).toBe(ep2.id);
    });

    it('treats podcast as episodic when typeOverride is episodic', async () => {
      const { podcast, ep1, ep2 } = await seedPodcastAndEpisodes({
        type: 'serial',
        typeOverride: 'episodic',
      });
      // Episodic: prev before ep1 (oldest) is ep2 (newer)
      expect(await getPrevEpisode(ep1.id, 'podcast', podcast.id)).toBe(ep2.id);
    });
  });

  describe('podcast context — missing data', () => {
    it('returns null when contextPodcastId is null', async () => {
      const { ep1 } = await seedPodcastAndEpisodes();
      expect(await getPrevEpisode(ep1.id, 'podcast', null)).toBeNull();
    });

    it('returns null when the current episode does not exist', async () => {
      const { podcast } = await seedPodcastAndEpisodes();
      expect(await getPrevEpisode(999999, 'podcast', podcast.id)).toBeNull();
    });

    it('returns null when the podcast record does not exist', async () => {
      const { ep1 } = await seedPodcastAndEpisodes();
      expect(await getPrevEpisode(ep1.id, 'podcast', 999999)).toBeNull();
    });
  });

  describe('favorites context', () => {
    let ep1Id: number, ep2Id: number, ep3Id: number;

    beforeEach(async () => {
      const { ep1, ep2, ep3 } = await seedPodcastAndEpisodes();
      ep1Id = ep1.id;
      ep2Id = ep2.id;
      ep3Id = ep3.id;

      await db.episode.update({
        where: { id: ep1Id },
        data: { favorited: true, favoritedAt: new Date('2024-01-01T00:00:00Z') },
      });
      await db.episode.update({
        where: { id: ep2Id },
        data: { favorited: true, favoritedAt: new Date('2024-02-01T00:00:00Z') },
      });
      await db.episode.update({
        where: { id: ep3Id },
        data: { favorited: true, favoritedAt: new Date('2024-03-01T00:00:00Z') },
      });
    });

    it('returns the previous episode in reverse-favorited order', async () => {
      // Favorites play newest-favorited first: ep3 → ep2 → ep1
      // prev from ep1 goes back toward ep2 (more recently favorited)
      expect(await getPrevEpisode(ep1Id, 'favorites', null)).toBe(ep2Id);
      expect(await getPrevEpisode(ep2Id, 'favorites', null)).toBe(ep3Id);
    });

    it('returns null at the start of favorites (most recently favorited)', async () => {
      expect(await getPrevEpisode(ep3Id, 'favorites', null)).toBeNull();
    });

    it('returns null when current episode has no favoritedAt', async () => {
      const { podcast } = await seedPodcastAndEpisodes();
      const unfavorited = await db.episode.create({
        data: {
          podcastId: podcast.id,
          guid: 'ep-unfav',
          title: 'Not Favorited',
          audioUrl: 'https://cdn.example.com/unfav.mp3',
          pubDate: new Date(),
        },
      });
      expect(await getPrevEpisode(unfavorited.id, 'favorites', null)).toBeNull();
    });
  });

  it('returns null for an unknown context', async () => {
    const { ep1 } = await seedPodcastAndEpisodes();
    expect(await getPrevEpisode(ep1.id, 'unknown', null)).toBeNull();
  });
});
