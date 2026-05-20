import { GET } from '@/app/api/playback/route';
import { db } from '@/lib/db';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/playback', () => {
  it('returns 200 with the playback state', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns the singleton state with id 1', async () => {
    const body = await (await GET()).json();
    expect(body.id).toBe(1);
    expect(body).toHaveProperty('isPlaying');
    expect(body).toHaveProperty('position');
    expect(body).toHaveProperty('context');
  });

  it('includes the loaded episode with podcast metadata when one is loaded', async () => {
    const podcast = await db.podcast.create({
      data: {
        title: 'Test Pod',
        feedUrl: 'https://feeds.example.com/test.rss',
        author: 'Author',
      },
    });
    const episode = await db.episode.create({
      data: {
        podcastId: podcast.id,
        guid: 'ep-1',
        title: 'Ep 1',
        audioUrl: 'u',
        pubDate: new Date(),
      },
    });
    await db.playbackState.update({
      where: { id: 1 },
      data: { episodeId: episode.id },
    });

    const body = await (await GET()).json();
    expect(body.episode).not.toBeNull();
    expect(body.episode.podcast.title).toBe('Test Pod');
    expect(body.episode.podcast.author).toBe('Author');
  });

  it('returns null episode when nothing is loaded', async () => {
    const body = await (await GET()).json();
    expect(body.episode).toBeNull();
  });
});
