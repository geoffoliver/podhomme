import { GET } from '@/app/api/export/opml/route';
import { db } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get() {
  return GET();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/export/opml', () => {
  it('returns 200', async () => {
    const res = await get();
    expect(res.status).toBe(200);
  });

  it('sets Content-Type to text/xml', async () => {
    const res = await get();
    expect(res.headers.get('Content-Type')).toMatch(/text\/xml/);
  });

  it('sets Content-Disposition as attachment with .opml filename', async () => {
    const res = await get();
    const cd = res.headers.get('Content-Disposition') ?? '';
    expect(cd).toMatch(/attachment/);
    expect(cd).toMatch(/\.opml/);
  });

  it('returns a valid OPML document', async () => {
    const text = await (await get()).text();
    expect(text).toMatch(/^<\?xml/);
    expect(text).toContain('<opml');
    expect(text).toContain('<body>');
  });

  it('returns an empty body outline when no podcasts are subscribed', async () => {
    const text = await (await get()).text();
    expect(text).not.toContain('<outline type="rss"');
  });

  it('includes an outline element for each subscribed podcast', async () => {
    await db.podcast.create({ data: { title: 'Pod A', feedUrl: 'https://a.example.com/feed.rss' } });
    await db.podcast.create({ data: { title: 'Pod B', feedUrl: 'https://b.example.com/feed.rss', siteUrl: 'https://b.example.com' } });

    const text = await (await get()).text();
    expect(text).toContain('https://a.example.com/feed.rss');
    expect(text).toContain('https://b.example.com/feed.rss');
    expect((text.match(/<outline type="rss"/g) ?? []).length).toBe(2);
  });

  it('includes the podcast title in the outline', async () => {
    await db.podcast.create({ data: { title: 'My Great Podcast', feedUrl: 'https://feeds.example.com/mgp.rss' } });

    const text = await (await get()).text();
    expect(text).toContain('My Great Podcast');
  });

  it('includes htmlUrl when the podcast has a siteUrl', async () => {
    await db.podcast.create({
      data: { title: 'Pod', feedUrl: 'https://feeds.example.com/pod.rss', siteUrl: 'https://pod.example.com' },
    });

    const text = await (await get()).text();
    expect(text).toContain('htmlUrl="https://pod.example.com"');
  });

  it('omits htmlUrl when siteUrl is null', async () => {
    await db.podcast.create({ data: { title: 'Pod', feedUrl: 'https://feeds.example.com/pod.rss' } });

    const text = await (await get()).text();
    expect(text).not.toContain('htmlUrl');
  });

  it('orders podcasts alphabetically by title', async () => {
    await db.podcast.create({ data: { title: 'Zebra Pod', feedUrl: 'https://z.example.com/feed.rss' } });
    await db.podcast.create({ data: { title: 'Alpha Pod', feedUrl: 'https://a.example.com/feed.rss' } });

    const text = await (await get()).text();
    expect(text.indexOf('Alpha Pod')).toBeLessThan(text.indexOf('Zebra Pod'));
  });

  it('escapes special XML characters in titles', async () => {
    await db.podcast.create({ data: { title: 'Rock & Roll <Podcast>', feedUrl: 'https://feeds.example.com/rock.rss' } });

    const text = await (await get()).text();
    expect(text).toContain('Rock &amp; Roll &lt;Podcast&gt;');
    expect(text).not.toContain('Rock & Roll <Podcast>');
  });
});
