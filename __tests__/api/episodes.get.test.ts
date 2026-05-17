import { GET } from '@/app/api/episodes/route';
import { db } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function get(params: Record<string, string | number> = {}) {
  const url = new URL('http://localhost/api/episodes');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return GET(new Request(url.toString()));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/episodes', () => {
  let podAId: number;
  let podBId: number;
  let ep1Id: number; // podcast A — older, played, not favorited
  let ep2Id: number; // podcast A — newer, unplayed, favorited
  let ep3Id: number; // podcast B — unplayed, favorited

  beforeEach(async () => {
    const [podA, podB] = await Promise.all([
      db.podcast.create({ data: { title: 'Podcast A', feedUrl: 'https://feeds.example.com/a.rss' } }),
      db.podcast.create({ data: { title: 'Podcast B', feedUrl: 'https://feeds.example.com/b.rss' } }),
    ]);
    podAId = podA.id;
    podBId = podB.id;

    const [ep1, ep2, ep3] = await Promise.all([
      db.episode.create({
        data: {
          podcastId: podAId, guid: 'ep-1', title: 'A Old',
          audioUrl: 'u', pubDate: new Date('2024-01-01'),
          played: true, favorited: false,
        },
      }),
      db.episode.create({
        data: {
          podcastId: podAId, guid: 'ep-2', title: 'A New',
          audioUrl: 'u', pubDate: new Date('2024-03-01'),
          played: false, favorited: true, favoritedAt: new Date(),
        },
      }),
      db.episode.create({
        data: {
          podcastId: podBId, guid: 'ep-3', title: 'B New',
          audioUrl: 'u', pubDate: new Date('2024-02-01'),
          played: false, favorited: true, favoritedAt: new Date(),
        },
      }),
    ]);
    ep1Id = ep1.id;
    ep2Id = ep2.id;
    ep3Id = ep3.id;
  });

  // ── no filters ─────────────────────────────────────────────────────────────

  it('returns all episodes when no filters are supplied', async () => {
    const res = await get();
    const body = await res.json();
    const ids = body.map((e: any) => e.id);
    expect(ids).toHaveLength(3);
    expect(ids).toContain(ep1Id);
    expect(ids).toContain(ep2Id);
    expect(ids).toContain(ep3Id);
  });

  it('orders episodes newest-first by pubDate', async () => {
    const res = await get();
    const body = await res.json();
    const ids = body.map((e: any) => e.id);
    // ep2 (Mar) → ep3 (Feb) → ep1 (Jan)
    expect(ids).toEqual([ep2Id, ep3Id, ep1Id]);
  });

  it('includes podcast metadata on each episode', async () => {
    const res = await get();
    const body = await res.json();
    const ep = body.find((e: any) => e.id === ep1Id);
    expect(ep.podcast).toBeDefined();
    expect(ep.podcast.title).toBe('Podcast A');
  });

  // ── podcastId filter ───────────────────────────────────────────────────────

  it('filters by podcastId', async () => {
    const res = await get({ podcastId: podAId });
    const body = await res.json();
    const ids = body.map((e: any) => e.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(ep1Id);
    expect(ids).toContain(ep2Id);
    expect(ids).not.toContain(ep3Id);
  });

  it('returns only that podcast\'s episodes when another podcast exists', async () => {
    const res = await get({ podcastId: podBId });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(ep3Id);
  });

  // ── favorited filter ───────────────────────────────────────────────────────

  it('filters to favorited episodes when favorited=true', async () => {
    const res = await get({ favorited: 'true' });
    const body = await res.json();
    const ids = body.map((e: any) => e.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(ep2Id);
    expect(ids).toContain(ep3Id);
    expect(ids).not.toContain(ep1Id);
  });

  it('does not filter when favorited is absent or not "true"', async () => {
    const res = await get({ favorited: 'false' });
    const body = await res.json();
    expect(body).toHaveLength(3);
  });

  // ── unplayed filter ────────────────────────────────────────────────────────

  it('filters to unplayed episodes when unplayed=true', async () => {
    const res = await get({ unplayed: 'true' });
    const body = await res.json();
    const ids = body.map((e: any) => e.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(ep2Id);
    expect(ids).toContain(ep3Id);
    expect(ids).not.toContain(ep1Id);
  });

  it('does not filter when unplayed is absent or not "true"', async () => {
    const res = await get({ unplayed: 'false' });
    const body = await res.json();
    expect(body).toHaveLength(3);
  });

  // ── combined filters ───────────────────────────────────────────────────────

  it('combines podcastId and favorited filters', async () => {
    const res = await get({ podcastId: podAId, favorited: 'true' });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(ep2Id);
  });

  it('combines podcastId and unplayed filters', async () => {
    const res = await get({ podcastId: podAId, unplayed: 'true' });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(ep2Id);
  });

  it('combines all three filters', async () => {
    const res = await get({ podcastId: podAId, favorited: 'true', unplayed: 'true' });
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(ep2Id);
  });
});
