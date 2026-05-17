jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));

import { POST } from '@/app/api/playback/route';
import { db } from '@/lib/db';
import { broadcast } from '@/lib/sse';

const mockBroadcast = broadcast as jest.MockedFunction<typeof broadcast>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function post(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

let podcastId: number;

async function seedEpisode(overrides: Record<string, unknown> = {}) {
  const episode = await db.episode.create({
    data: {
      podcastId,
      guid: `ep-${Math.random().toString(36).slice(2)}`,
      title: 'Episode',
      audioUrl: 'https://cdn.example.com/ep.mp3',
      pubDate: new Date('2024-01-01'),
      ...overrides,
    },
  });
  return episode;
}

async function setPlaybackState(overrides: Record<string, unknown>) {
  return db.playbackState.update({ where: { id: 1 }, data: overrides });
}

function playbackBroadcasts() {
  return mockBroadcast.mock.calls.filter(([event]) => event === 'playback');
}

function episodeBroadcasts() {
  return mockBroadcast.mock.calls.filter(([event]) => event === 'episode');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/playback', () => {
  beforeEach(async () => {
    mockBroadcast.mockClear();
    const podcast = await db.podcast.create({
      data: { title: 'Test Podcast', feedUrl: 'https://feeds.example.com/test.rss' },
    });
    podcastId = podcast.id;
  });

  // ── load ───────────────────────────────────────────────────────────────────

  describe('load', () => {
    it('sets episodeId and starts playing', async () => {
      const episode = await seedEpisode();

      const res = await post({ action: 'load', episodeId: episode.id, context: 'all' });
      const body = await res.json();

      expect(body.episodeId).toBe(episode.id);
      expect(body.isPlaying).toBe(true);
    });

    it('starts at the episode resumeAt position', async () => {
      const episode = await seedEpisode({ resumeAt: 120 });

      const res = await post({ action: 'load', episodeId: episode.id, context: 'all' });
      const body = await res.json();

      expect(body.position).toBe(120);
    });

    it('defaults position to 0 when resumeAt is 0', async () => {
      const episode = await seedEpisode({ resumeAt: 0 });

      const res = await post({ action: 'load', episodeId: episode.id, context: 'all' });
      const body = await res.json();

      expect(body.position).toBe(0);
    });

    it('sets context and contextPodcastId from the request body', async () => {
      const episode = await seedEpisode();

      const res = await post({
        action: 'load',
        episodeId: episode.id,
        context: 'podcast',
        contextPodcastId: podcastId,
      });
      const body = await res.json();

      expect(body.context).toBe('podcast');
      expect(body.contextPodcastId).toBe(podcastId);
    });

    it('saves the outgoing episode position as resumeAt before switching', async () => {
      const outgoing = await seedEpisode({ guid: 'ep-out' });
      const incoming = await seedEpisode();
      await setPlaybackState({ episodeId: outgoing.id, position: 77 });

      await post({ action: 'load', episodeId: incoming.id, context: 'all' });

      const saved = await db.episode.findUnique({ where: { id: outgoing.id } });
      expect(saved?.resumeAt).toBe(77);
    });

    it('broadcasts episode for the outgoing episode and playback for the new state', async () => {
      const outgoing = await seedEpisode({ guid: 'ep-out' });
      const incoming = await seedEpisode();
      await setPlaybackState({ episodeId: outgoing.id, position: 30 });

      await post({ action: 'load', episodeId: incoming.id, context: 'all' });

      expect(episodeBroadcasts()).toHaveLength(1);
      expect(playbackBroadcasts()).toHaveLength(1);
    });
  });

  // ── play ───────────────────────────────────────────────────────────────────

  describe('play', () => {
    it('sets isPlaying to true', async () => {
      await setPlaybackState({ isPlaying: false });

      const res = await post({ action: 'play' });
      const body = await res.json();

      expect(body.isPlaying).toBe(true);
    });

    it('broadcasts playback', async () => {
      await post({ action: 'play' });
      expect(playbackBroadcasts()).toHaveLength(1);
    });
  });

  // ── pause ──────────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('sets isPlaying to false', async () => {
      await setPlaybackState({ isPlaying: true });

      const res = await post({ action: 'pause' });
      const body = await res.json();

      expect(body.isPlaying).toBe(false);
    });

    it('uses the position from the request body when provided', async () => {
      const res = await post({ action: 'pause', position: 99 });
      const body = await res.json();

      expect(body.position).toBe(99);
    });

    it('falls back to the current state position when body omits position', async () => {
      await setPlaybackState({ position: 55 });

      const res = await post({ action: 'pause' });
      const body = await res.json();

      expect(body.position).toBe(55);
    });

    it('saves the paused position as resumeAt on the current episode', async () => {
      const episode = await seedEpisode();
      await setPlaybackState({ episodeId: episode.id, position: 42 });

      await post({ action: 'pause' });

      const saved = await db.episode.findUnique({ where: { id: episode.id } });
      expect(saved?.resumeAt).toBe(42);
    });

    it('broadcasts episode (resumeAt save) and playback', async () => {
      const episode = await seedEpisode();
      await setPlaybackState({ episodeId: episode.id });

      await post({ action: 'pause' });

      expect(episodeBroadcasts()).toHaveLength(1);
      expect(playbackBroadcasts()).toHaveLength(1);
    });
  });

  // ── seek ───────────────────────────────────────────────────────────────────

  describe('seek', () => {
    it('updates the playback position', async () => {
      const res = await post({ action: 'seek', position: 200 });
      const body = await res.json();

      expect(body.position).toBe(200);
    });

    it('broadcasts playback', async () => {
      await post({ action: 'seek', position: 0 });
      expect(playbackBroadcasts()).toHaveLength(1);
    });
  });

  // ── sync ───────────────────────────────────────────────────────────────────

  describe('sync', () => {
    it('updates the playback position', async () => {
      const res = await post({ action: 'sync', position: 150 });
      const body = await res.json();

      expect(body.position).toBe(150);
    });

    it('does not broadcast playback (silent heartbeat)', async () => {
      await post({ action: 'sync', position: 0 });
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('silently updates resumeAt on the current episode', async () => {
      const episode = await seedEpisode();
      await setPlaybackState({ episodeId: episode.id });

      await post({ action: 'sync', position: 88 });

      const saved = await db.episode.findUnique({ where: { id: episode.id } });
      expect(saved?.resumeAt).toBe(88);
    });
  });

  // ── next ───────────────────────────────────────────────────────────────────

  describe('next', () => {
    it('marks the current episode as played and clears its resumeAt', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1', resumeAt: 60 });
      const ep2 = await seedEpisode();
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep1.id, context: 'all' });

      await post({ action: 'next' });

      const ep1After = await db.episode.findUnique({ where: { id: ep1.id } });
      expect(ep1After?.played).toBe(true);
      expect(ep1After?.resumeAt).toBe(0);
    });

    it('removes the completed episode from the queue', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1' });
      const ep2 = await seedEpisode();
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep1.id, context: 'all' });

      await post({ action: 'next' });

      const ep1InQueue = await db.queueItem.findUnique({ where: { episodeId: ep1.id } });
      expect(ep1InQueue).toBeNull();
    });

    it('loads the next episode at its resumeAt position', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1' });
      const ep2 = await seedEpisode({ guid: 'ep-2', resumeAt: 30 });
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep1.id, context: 'all' });

      const res = await post({ action: 'next' });
      const body = await res.json();

      expect(body.episodeId).toBe(ep2.id);
      expect(body.position).toBe(30);
      expect(body.isPlaying).toBe(true);
    });

    it('stops playback when there is no next episode', async () => {
      const episode = await seedEpisode();
      await db.queueItem.create({ data: { episodeId: episode.id, position: 0 } });
      await setPlaybackState({ episodeId: episode.id, context: 'all' });

      const res = await post({ action: 'next' });
      const body = await res.json();

      expect(body.isPlaying).toBe(false);
      expect(body.episodeId).toBeNull();
      expect(body.position).toBe(0);
    });

    it('broadcasts episode for the completed episode and playback for the new state', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1' });
      const ep2 = await seedEpisode();
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep1.id, context: 'all' });

      await post({ action: 'next' });

      expect(episodeBroadcasts()).toHaveLength(1);
      expect(playbackBroadcasts()).toHaveLength(1);
    });

    it('returns { ok: true } immediately when no episode is currently loaded', async () => {
      const res = await post({ action: 'next' });
      const body = await res.json();

      expect(body).toEqual({ ok: true });
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  // ── prev ───────────────────────────────────────────────────────────────────

  describe('prev', () => {
    it('saves the current position as resumeAt on the current episode', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1' });
      const ep2 = await seedEpisode({ guid: 'ep-2' });
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep2.id, position: 65, context: 'all' });

      await post({ action: 'prev' });

      const ep2After = await db.episode.findUnique({ where: { id: ep2.id } });
      expect(ep2After?.resumeAt).toBe(65);
    });

    it('loads the previous episode at its resumeAt position', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1', resumeAt: 20 });
      const ep2 = await seedEpisode({ guid: 'ep-2' });
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep2.id, context: 'all' });

      const res = await post({ action: 'prev' });
      const body = await res.json();

      expect(body.episodeId).toBe(ep1.id);
      expect(body.position).toBe(20);
      expect(body.isPlaying).toBe(true);
    });

    it('does not mark the current episode as played', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1' });
      const ep2 = await seedEpisode({ guid: 'ep-2' });
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep2.id, context: 'all' });

      await post({ action: 'prev' });

      const ep2After = await db.episode.findUnique({ where: { id: ep2.id } });
      expect(ep2After?.played).toBe(false);
    });

    it('stops playback when there is no previous episode', async () => {
      const episode = await seedEpisode();
      await db.queueItem.create({ data: { episodeId: episode.id, position: 0 } });
      await setPlaybackState({ episodeId: episode.id, context: 'all' });

      const res = await post({ action: 'prev' });
      const body = await res.json();

      expect(body.isPlaying).toBe(false);
      expect(body.episodeId).toBeNull();
    });

    it('broadcasts episode (position save) and playback', async () => {
      const ep1 = await seedEpisode({ guid: 'ep-1' });
      const ep2 = await seedEpisode({ guid: 'ep-2' });
      await db.queueItem.createMany({
        data: [
          { episodeId: ep1.id, position: 0 },
          { episodeId: ep2.id, position: 1 },
        ],
      });
      await setPlaybackState({ episodeId: ep2.id, context: 'all' });

      await post({ action: 'prev' });

      expect(episodeBroadcasts()).toHaveLength(1);
      expect(playbackBroadcasts()).toHaveLength(1);
    });

    it('returns { ok: true } immediately when no episode is currently loaded', async () => {
      const res = await post({ action: 'prev' });
      const body = await res.json();

      expect(body).toEqual({ ok: true });
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  // ── unknown action ─────────────────────────────────────────────────────────

  it('returns 400 for an unknown action', async () => {
    const res = await post({ action: 'rewind' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
