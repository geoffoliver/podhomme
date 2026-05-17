import { parseOpml } from '@/lib/feed';

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
