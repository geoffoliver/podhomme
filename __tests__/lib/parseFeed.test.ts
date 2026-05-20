// rss-parser is a class whose instance is created at feed.ts module load time.
// We mock the constructor so the module-level `parser` gets jest.fn()s for parseString.
jest.mock('rss-parser', () => jest.fn(() => ({ parseString: jest.fn() })));

import { parseFeed } from '@/lib/feed';
import Parser from 'rss-parser';
import { USER_AGENT } from '@/lib/user-agent';

const MockParser = Parser as jest.MockedClass<any>;
let mockParseString: jest.Mock;
let mockFetch: jest.Mock;

// Helper to build a fake Response-like object
function makeResponse(
  status: number,
  body = '<rss/>',
  headers: Record<string, string> = {},
) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

beforeAll(() => {
  mockParseString = MockParser.mock.results[0].value.parseString;
});

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
  mockParseString.mockReset();
  // Default: 200 response with no conditional headers
  mockFetch.mockResolvedValue(makeResponse(200));
});

// Convenience: call parseFeed and assert it returned a full result (not 304)
async function parse(url = FEED_URL, cache?: Parameters<typeof parseFeed>[1]) {
  const r = await parseFeed(url, cache);
  if (r.notModified) throw new Error('Unexpected notModified result');
  return r;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRawFeed(overrides: Record<string, unknown> = {}) {
  return {
    title: 'My Podcast',
    description: 'Desc',
    link: 'https://example.com',
    items: [],
    ...overrides,
  };
}

function makeRawItem(overrides: Record<string, unknown> = {}) {
  return {
    guid: 'ep-001',
    title: 'Episode 1',
    enclosure: { url: 'https://cdn.example.com/ep.mp3', type: 'audio/mpeg' },
    pubDate: 'Mon, 01 Jan 2024 00:00:00 +0000',
    ...overrides,
  };
}

const FEED_URL = 'https://feeds.example.com/test.rss';

// ─── HTTP behaviour ───────────────────────────────────────────────────────────

describe('parseFeed — HTTP behaviour', () => {
  it('sends a User-Agent header', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    await parse();
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      'User-Agent': USER_AGENT,
    });
  });

  it('sends If-None-Match when an etag is provided', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    await parse(FEED_URL, { etag: '"abc123"' });
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      'If-None-Match': '"abc123"',
    });
  });

  it('sends If-Modified-Since when a lastModified date is provided', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    await parse(FEED_URL, { lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT' });
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT',
    });
  });

  it('omits conditional headers when cache values are null', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    await parse(FEED_URL, { etag: null, lastModified: null });
    const [, init] = mockFetch.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['If-None-Match']).toBeUndefined();
    expect(headers['If-Modified-Since']).toBeUndefined();
  });

  it('returns { notModified: true } on a 304 response', async () => {
    mockFetch.mockResolvedValue(makeResponse(304));
    const result = await parseFeed(FEED_URL, { etag: '"abc"' });
    expect(result).toEqual({ notModified: true });
    expect(mockParseString).not.toHaveBeenCalled();
  });

  it('returns the etag from the response headers', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    mockFetch.mockResolvedValue(makeResponse(200, '<rss/>', { etag: '"xyz"' }));
    const result = await parse();
    expect(result.etag).toBe('"xyz"');
  });

  it('returns the last-modified from the response headers', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    mockFetch.mockResolvedValue(
      makeResponse(200, '<rss/>', {
        'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT',
      }),
    );
    const result = await parse();
    expect(result.lastModified).toBe('Tue, 01 Jan 2030 00:00:00 GMT');
  });

  it('returns null etag and lastModified when those headers are absent', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    const result = await parse();
    expect(result.etag).toBeNull();
    expect(result.lastModified).toBeNull();
  });
});

// ─── Feed metadata ────────────────────────────────────────────────────────────

describe('parseFeed — feed metadata', () => {
  it('returns the feed title', async () => {
    mockParseString.mockResolvedValue(makeRawFeed({ title: 'Cool Podcast' }));
    expect((await parse()).feed.title).toBe('Cool Podcast');
  });

  it('falls back to "Untitled Podcast" when title is absent', async () => {
    mockParseString.mockResolvedValue(makeRawFeed({ title: undefined }));
    expect((await parse()).feed.title).toBe('Untitled Podcast');
  });

  it('returns the feed description, null when absent', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({ description: 'About this show' }),
    );
    expect((await parse()).feed.description).toBe('About this show');

    mockParseString.mockResolvedValue(makeRawFeed({ description: undefined }));
    expect((await parse()).feed.description).toBeNull();
  });

  it('returns feed.link as siteUrl', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({ link: 'https://mypodcast.com' }),
    );
    expect((await parse()).feed.siteUrl).toBe('https://mypodcast.com');
  });

  it('prefers itunes:author over creator for the author field', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({ 'itunes:author': 'iTunes Author', creator: 'RSS Creator' }),
    );
    expect((await parse()).feed.author).toBe('iTunes Author');
  });

  it('falls back to creator when itunes:author is absent', async () => {
    mockParseString.mockResolvedValue(makeRawFeed({ creator: 'RSS Creator' }));
    expect((await parse()).feed.author).toBe('RSS Creator');
  });

  it('returns null author when neither itunes:author nor creator is present', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    expect((await parse()).feed.author).toBeNull();
  });
});

// ─── Feed type ────────────────────────────────────────────────────────────────

describe('parseFeed — feed type', () => {
  it('returns "serial" when itunes:type is "serial" (case-insensitive)', async () => {
    mockParseString.mockResolvedValue(makeRawFeed({ 'itunes:type': 'Serial' }));
    expect((await parse()).feed.type).toBe('serial');
  });

  it('returns "episodic" when itunes:type is absent', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    expect((await parse()).feed.type).toBe('episodic');
  });

  it('returns "episodic" for non-serial values', async () => {
    mockParseString.mockResolvedValue(makeRawFeed({ 'itunes:type': 'episodic' }));
    expect((await parse()).feed.type).toBe('episodic');
  });
});

// ─── Image extraction ─────────────────────────────────────────────────────────

describe('parseFeed — image extraction', () => {
  it('returns a plain string image URL', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({ 'itunes:image': 'https://img.example.com/art.jpg' }),
    );
    expect((await parse()).feed.imageUrl).toBe('https://img.example.com/art.jpg');
  });

  it('extracts href from an object with href property', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        'itunes:image': { href: 'https://img.example.com/art.jpg' },
      }),
    );
    expect((await parse()).feed.imageUrl).toBe('https://img.example.com/art.jpg');
  });

  it('extracts href from an xml2js-style attributes object', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        'itunes:image': { $: { href: 'https://img.example.com/art.jpg' } },
      }),
    );
    expect((await parse()).feed.imageUrl).toBe('https://img.example.com/art.jpg');
  });

  it('falls back to feed.image when itunes:image is absent', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({ image: { url: 'https://img.example.com/rss.jpg' } }),
    );
    expect((await parse()).feed.imageUrl).toBe('https://img.example.com/rss.jpg');
  });

  it('returns null when no image is present', async () => {
    mockParseString.mockResolvedValue(makeRawFeed());
    expect((await parse()).feed.imageUrl).toBeNull();
  });
});

// ─── Episodes ─────────────────────────────────────────────────────────────────

describe('parseFeed — episodes', () => {
  it('maps the enclosure URL to audioUrl', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [
          makeRawItem({
            enclosure: {
              url: 'https://cdn.example.com/ep.mp3',
              type: 'audio/mpeg',
            },
          }),
        ],
      }),
    );
    const { feed } = await parse();
    expect(feed.episodes[0].audioUrl).toBe('https://cdn.example.com/ep.mp3');
  });

  it('omits items that have no enclosure', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [
          makeRawItem({ enclosure: undefined }),
          makeRawItem({ guid: 'ep-002' }),
        ],
      }),
    );
    const { feed } = await parse();
    expect(feed.episodes).toHaveLength(1);
    expect(feed.episodes[0].guid).toBe('ep-002');
  });

  it('sets mediaType to "video" for video/* enclosures', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [
          makeRawItem({
            enclosure: {
              url: 'https://cdn.example.com/ep.mp4',
              type: 'video/mp4',
            },
          }),
        ],
      }),
    );
    const { feed } = await parse();
    expect(feed.episodes[0].mediaType).toBe('video');
  });

  it('defaults mediaType to "audio" for non-video enclosures', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [
          makeRawItem({
            enclosure: {
              url: 'https://cdn.example.com/ep.mp3',
              type: 'audio/mpeg',
            },
          }),
        ],
      }),
    );
    const { feed } = await parse();
    expect(feed.episodes[0].mediaType).toBe('audio');
  });

  it('returns all episodes from the feed', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [
          makeRawItem({ guid: 'ep-1' }),
          makeRawItem({ guid: 'ep-2' }),
          makeRawItem({ guid: 'ep-3' }),
        ],
      }),
    );
    const { feed } = await parse();
    expect(feed.episodes).toHaveLength(3);
  });

  it('uses guid, then link, then title as episode guid fallbacks', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({ items: [makeRawItem({ guid: 'my-guid' })] }),
    );
    expect((await parse()).feed.episodes[0].guid).toBe('my-guid');

    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [makeRawItem({ guid: undefined, link: 'https://ep.link' })],
      }),
    );
    expect((await parse()).feed.episodes[0].guid).toBe('https://ep.link');
  });

  it('parses pubDate string into a Date', async () => {
    mockParseString.mockResolvedValue(
      makeRawFeed({
        items: [makeRawItem({ pubDate: 'Mon, 15 Jan 2024 12:00:00 +0000' })],
      }),
    );
    const { feed } = await parse();
    expect(feed.episodes[0].pubDate).toBeInstanceOf(Date);
    expect(feed.episodes[0].pubDate.getFullYear()).toBe(2024);
  });

  describe('description fallbacks', () => {
    it('uses content first', async () => {
      mockParseString.mockResolvedValue(
        makeRawFeed({
          items: [
            makeRawItem({
              content: 'Full content',
              contentSnippet: 'Snippet',
              'itunes:summary': 'Summary',
            }),
          ],
        }),
      );
      expect((await parse()).feed.episodes[0].description).toBe('Full content');
    });

    it('falls back to contentSnippet when content is absent', async () => {
      mockParseString.mockResolvedValue(
        makeRawFeed({
          items: [
            makeRawItem({
              contentSnippet: 'Snippet',
              'itunes:summary': 'Summary',
            }),
          ],
        }),
      );
      expect((await parse()).feed.episodes[0].description).toBe('Snippet');
    });

    it('falls back to itunes:summary when neither content nor snippet is present', async () => {
      mockParseString.mockResolvedValue(
        makeRawFeed({
          items: [makeRawItem({ 'itunes:summary': 'Summary' })],
        }),
      );
      expect((await parse()).feed.episodes[0].description).toBe('Summary');
    });

    it('returns null when no description source is present', async () => {
      mockParseString.mockResolvedValue(makeRawFeed({ items: [makeRawItem()] }));
      expect((await parse()).feed.episodes[0].description).toBeNull();
    });
  });

  describe('duration parsing', () => {
    async function duration(raw: unknown) {
      mockParseString.mockResolvedValue(
        makeRawFeed({
          items: [makeRawItem({ 'itunes:duration': raw })],
        }),
      );
      return (await parse()).feed.episodes[0].duration;
    }

    it('parses HH:MM:SS into total seconds', async () => {
      expect(await duration('1:02:03')).toBe(3723);
    });

    it('parses MM:SS into total seconds', async () => {
      expect(await duration('1:30')).toBe(90);
    });

    it('parses a plain-number string as seconds', async () => {
      expect(await duration('3600')).toBe(3600);
    });

    it('floors a raw number value', async () => {
      expect(await duration(90.9)).toBe(90);
    });

    it('returns null when duration is absent', async () => {
      expect(await duration(undefined)).toBeNull();
    });

    it('returns null for an unparseable string', async () => {
      expect(await duration('not-a-number')).toBeNull();
    });
  });
});
