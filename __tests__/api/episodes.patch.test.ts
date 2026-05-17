jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));

import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/episodes/[id]/route';
import { db } from '@/lib/db';
import { broadcast } from '@/lib/sse';

const mockBroadcast = broadcast as jest.MockedFunction<typeof broadcast>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest(`http://localhost/api/episodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) } as any,
  );
}

let podcastId: number;
let seq = 0;

async function seedEpisode(overrides: Record<string, unknown> = {}) {
  return db.episode.create({
    data: {
      podcastId,
      guid: `ep-${++seq}`,
      title: 'Episode',
      audioUrl: 'https://cdn.example.com/ep.mp3',
      pubDate: new Date('2024-01-01'),
      ...overrides,
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /api/episodes/[id]', () => {
  beforeEach(async () => {
    mockBroadcast.mockClear();
    const podcast = await db.podcast.create({
      data: { title: 'Test Podcast', feedUrl: 'https://feeds.example.com/test.rss' },
    });
    podcastId = podcast.id;
  });

  // ── played: true ───────────────────────────────────────────────────────────

  describe('marking an episode played', () => {
    it('sets played:true and records playedAt', async () => {
      const episode = await seedEpisode({ played: false });

      const res = await patch(episode.id, { played: true });
      const body = await res.json();

      expect(body.played).toBe(true);
      expect(body.playedAt).not.toBeNull();
    });

    it('clears resumeAt to 0', async () => {
      const episode = await seedEpisode({ resumeAt: 90 });

      await patch(episode.id, { played: true });

      const saved = await db.episode.findUnique({ where: { id: episode.id } });
      expect(saved?.resumeAt).toBe(0);
    });

    it('removes the episode from the queue', async () => {
      const episode = await seedEpisode();
      await db.queueItem.create({ data: { episodeId: episode.id, position: 0 } });

      await patch(episode.id, { played: true });

      const qi = await db.queueItem.findUnique({ where: { episodeId: episode.id } });
      expect(qi).toBeNull();
    });

    it('broadcasts only the episode event', async () => {
      const episode = await seedEpisode();

      await patch(episode.id, { played: true });

      expect(mockBroadcast).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledWith('episode', expect.anything());
    });
  });

  // ── played: false ──────────────────────────────────────────────────────────

  describe('marking an episode unplayed', () => {
    it('sets played:false and clears playedAt', async () => {
      const episode = await seedEpisode({ played: true, playedAt: new Date() });

      const res = await patch(episode.id, { played: false });
      const body = await res.json();

      expect(body.played).toBe(false);
      expect(body.playedAt).toBeNull();
    });

    it('re-adds the episode to the end of the queue', async () => {
      const other = await seedEpisode();
      await db.queueItem.create({ data: { episodeId: other.id, position: 0 } });

      const episode = await seedEpisode({ played: true });

      await patch(episode.id, { played: false });

      const qi = await db.queueItem.findUnique({ where: { episodeId: episode.id } });
      expect(qi).not.toBeNull();
      expect(qi?.position).toBe(1);
    });

    it('adds at position 0 when the queue is empty', async () => {
      const episode = await seedEpisode({ played: true });

      await patch(episode.id, { played: false });

      const qi = await db.queueItem.findUnique({ where: { episodeId: episode.id } });
      expect(qi?.position).toBe(0);
    });

    it('does not add a second queue entry if the episode is already queued', async () => {
      const episode = await seedEpisode({ played: true });
      await db.queueItem.create({ data: { episodeId: episode.id, position: 0 } });

      await patch(episode.id, { played: false });

      expect(await db.queueItem.count({ where: { episodeId: episode.id } })).toBe(1);
    });

    it('broadcasts queue and episode events', async () => {
      const episode = await seedEpisode({ played: true });

      await patch(episode.id, { played: false });

      const events = mockBroadcast.mock.calls.map(([event]) => event);
      expect(events).toContain('queue');
      expect(events).toContain('episode');
    });
  });

  // ── favorited ──────────────────────────────────────────────────────────────

  describe('favoriting', () => {
    it('sets favorited:true and records favoritedAt', async () => {
      const episode = await seedEpisode({ favorited: false });

      const res = await patch(episode.id, { favorited: true });
      const body = await res.json();

      expect(body.favorited).toBe(true);
      expect(body.favoritedAt).not.toBeNull();
    });

    it('sets favorited:false and clears favoritedAt', async () => {
      const episode = await seedEpisode({ favorited: true, favoritedAt: new Date() });

      const res = await patch(episode.id, { favorited: false });
      const body = await res.json();

      expect(body.favorited).toBe(false);
      expect(body.favoritedAt).toBeNull();
    });

    it('broadcasts the episode event', async () => {
      const episode = await seedEpisode();

      await patch(episode.id, { favorited: true });

      expect(mockBroadcast).toHaveBeenCalledWith('episode', expect.anything());
    });
  });

  // ── combined ───────────────────────────────────────────────────────────────

  describe('combined fields', () => {
    it('can mark played and favorited in a single request', async () => {
      const episode = await seedEpisode({ played: false, favorited: false });

      const res = await patch(episode.id, { played: true, favorited: true });
      const body = await res.json();

      expect(body.played).toBe(true);
      expect(body.favorited).toBe(true);
      expect(body.playedAt).not.toBeNull();
      expect(body.favoritedAt).not.toBeNull();
    });
  });

  // ── response ───────────────────────────────────────────────────────────────

  it('returns the updated episode as JSON', async () => {
    const episode = await seedEpisode();

    const res = await patch(episode.id, { favorited: true });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(episode.id);
    expect(body.favorited).toBe(true);
  });
});
