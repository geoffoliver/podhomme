import { parseOpml, buildOpml } from '@/lib/feed';

describe('parseOpml', () => {
  it('extracts feed URLs from a flat OPML body', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Podcasts</title></head>
  <body>
    <outline text="Never Not Funny" title="Never Not Funny"
             type="rss" xmlUrl="https://feeds.example.com/nnf.rss"/>
    <outline text="99% Invisible" title="99% Invisible"
             type="rss" xmlUrl="https://feeds.99pi.org/99percentinvisible.rss"/>
  </body>
</opml>`;

    const result = parseOpml(xml);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: 'Never Not Funny',
      feedUrl: 'https://feeds.example.com/nnf.rss',
    });
    expect(result[1]).toEqual({
      title: '99% Invisible',
      feedUrl: 'https://feeds.99pi.org/99percentinvisible.rss',
    });
  });

  it('handles nested OPML folders', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Comedy">
      <outline text="Comedy Bang Bang" title="Comedy Bang Bang"
               type="rss" xmlUrl="https://feeds.example.com/cbb.rss"/>
    </outline>
  </body>
</opml>`;

    const result = parseOpml(xml);

    expect(result).toHaveLength(1);
    expect(result[0].feedUrl).toBe('https://feeds.example.com/cbb.rss');
  });

  it('returns an empty array for an OPML with no feeds', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body></body>
</opml>`;

    expect(parseOpml(xml)).toHaveLength(0);
  });
});

describe('buildOpml', () => {
  it('produces a valid XML declaration and opml root', () => {
    const xml = buildOpml([]);
    expect(xml).toMatch(/^<\?xml version="1\.0"/);
    expect(xml).toContain('<opml version="2.0">');
  });

  it('includes a body element', () => {
    expect(buildOpml([])).toContain('<body>');
  });

  it('creates an outline element for each podcast', () => {
    const xml = buildOpml([
      { title: 'Pod A', feedUrl: 'https://a.example.com/feed.rss' },
      { title: 'Pod B', feedUrl: 'https://b.example.com/feed.rss' },
    ]);
    expect((xml.match(/<outline type="rss"/g) ?? []).length).toBe(2);
  });

  it('sets xmlUrl to the feedUrl', () => {
    const xml = buildOpml([
      { title: 'Pod', feedUrl: 'https://feeds.example.com/pod.rss' },
    ]);
    expect(xml).toContain('xmlUrl="https://feeds.example.com/pod.rss"');
  });

  it('includes htmlUrl when siteUrl is provided', () => {
    const xml = buildOpml([
      {
        title: 'Pod',
        feedUrl: 'https://f.example.com/pod.rss',
        siteUrl: 'https://pod.example.com',
      },
    ]);
    expect(xml).toContain('htmlUrl="https://pod.example.com"');
  });

  it('omits htmlUrl when siteUrl is null or undefined', () => {
    expect(
      buildOpml([
        {
          title: 'Pod',
          feedUrl: 'https://f.example.com/pod.rss',
          siteUrl: null,
        },
      ]),
    ).not.toContain('htmlUrl');
    expect(
      buildOpml([{ title: 'Pod', feedUrl: 'https://f.example.com/pod.rss' }]),
    ).not.toContain('htmlUrl');
  });

  it('escapes & in titles', () => {
    const xml = buildOpml([
      { title: 'Rock & Roll', feedUrl: 'https://f.example.com/r.rss' },
    ]);
    expect(xml).toContain('Rock &amp; Roll');
    expect(xml).not.toContain('Rock & Roll');
  });

  it('escapes < and > in titles', () => {
    const xml = buildOpml([
      { title: '<Podcast>', feedUrl: 'https://f.example.com/r.rss' },
    ]);
    expect(xml).toContain('&lt;Podcast&gt;');
  });
});
