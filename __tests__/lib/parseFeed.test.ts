// rss-parser is a class whose instance is created at feed.ts module load time.
// We mock the constructor so the module-level `parser` gets a jest.fn() for parseURL.
jest.mock('rss-parser', () => jest.fn(() => ({ parseURL: jest.fn() })));

import { parseFeed } from '@/lib/feed';
import Parser from 'rss-parser';

// Grab the parseURL mock from the one instance created when feed.ts loaded.
// mock.results[0].value is the returned object; mock.instances[0] is the raw `this` (no parseURL).
const MockParser = Parser as jest.MockedClass<any>;
let mockParseURL: jest.Mock;

beforeAll(() => {
  mockParseURL = MockParser.mock.results[0].value.parseURL;
});

beforeEach(() => {
  mockParseURL.mockReset();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRawFeed(overrides: Record<string, unknown> = {}) {
  return { title: 'My Podcast', description: 'Desc', link: 'https://example.com', items: [], ...overrides };
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

const URL = 'https://feeds.example.com/test.rss';

// ─── Feed metadata ────────────────────────────────────────────────────────────

describe('parseFeed — feed metadata', () => {
  it('returns the feed title', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ title: 'Cool Podcast' }));
    const result = await parseFeed(URL);
    expect(result.title).toBe('Cool Podcast');
  });

  it('falls back to "Untitled Podcast" when title is absent', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ title: undefined }));
    const result = await parseFeed(URL);
    expect(result.title).toBe('Untitled Podcast');
  });

  it('returns the feed description, null when absent', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ description: 'About this show' }));
    expect((await parseFeed(URL)).description).toBe('About this show');

    mockParseURL.mockResolvedValue(makeRawFeed({ description: undefined }));
    expect((await parseFeed(URL)).description).toBeNull();
  });

  it('returns feed.link as siteUrl', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ link: 'https://mypodcast.com' }));
    expect((await parseFeed(URL)).siteUrl).toBe('https://mypodcast.com');
  });

  it('prefers itunes:author over creator for the author field', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ 'itunes:author': 'iTunes Author', creator: 'RSS Creator' }));
    expect((await parseFeed(URL)).author).toBe('iTunes Author');
  });

  it('falls back to creator when itunes:author is absent', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ creator: 'RSS Creator' }));
    expect((await parseFeed(URL)).author).toBe('RSS Creator');
  });

  it('returns null author when neither itunes:author nor creator is present', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed());
    expect((await parseFeed(URL)).author).toBeNull();
  });
});

// ─── Feed type ────────────────────────────────────────────────────────────────

describe('parseFeed — feed type', () => {
  it('returns "serial" when itunes:type is "serial" (case-insensitive)', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ 'itunes:type': 'Serial' }));
    expect((await parseFeed(URL)).type).toBe('serial');
  });

  it('returns "episodic" when itunes:type is absent', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed());
    expect((await parseFeed(URL)).type).toBe('episodic');
  });

  it('returns "episodic" for non-serial values', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ 'itunes:type': 'episodic' }));
    expect((await parseFeed(URL)).type).toBe('episodic');
  });
});

// ─── Image extraction ─────────────────────────────────────────────────────────

describe('parseFeed — image extraction', () => {
  it('returns a plain string image URL', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ 'itunes:image': 'https://img.example.com/art.jpg' }));
    expect((await parseFeed(URL)).imageUrl).toBe('https://img.example.com/art.jpg');
  });

  it('extracts href from an object with href property', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ 'itunes:image': { href: 'https://img.example.com/art.jpg' } }));
    expect((await parseFeed(URL)).imageUrl).toBe('https://img.example.com/art.jpg');
  });

  it('extracts href from an xml2js-style attributes object', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ 'itunes:image': { $: { href: 'https://img.example.com/art.jpg' } } }));
    expect((await parseFeed(URL)).imageUrl).toBe('https://img.example.com/art.jpg');
  });

  it('falls back to feed.image when itunes:image is absent', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ image: { url: 'https://img.example.com/rss.jpg' } }));
    expect((await parseFeed(URL)).imageUrl).toBe('https://img.example.com/rss.jpg');
  });

  it('returns null when no image is present', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed());
    expect((await parseFeed(URL)).imageUrl).toBeNull();
  });
});

// ─── Episodes ─────────────────────────────────────────────────────────────────

describe('parseFeed — episodes', () => {
  it('maps the enclosure URL to audioUrl', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({
      items: [makeRawItem({ enclosure: { url: 'https://cdn.example.com/ep.mp3', type: 'audio/mpeg' } })],
    }));
    const { episodes } = await parseFeed(URL);
    expect(episodes[0].audioUrl).toBe('https://cdn.example.com/ep.mp3');
  });

  it('omits items that have no enclosure', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({
      items: [makeRawItem({ enclosure: undefined }), makeRawItem({ guid: 'ep-002' })],
    }));
    const { episodes } = await parseFeed(URL);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].guid).toBe('ep-002');
  });

  it('sets mediaType to "video" for video/* enclosures', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({
      items: [makeRawItem({ enclosure: { url: 'https://cdn.example.com/ep.mp4', type: 'video/mp4' } })],
    }));
    const { episodes } = await parseFeed(URL);
    expect(episodes[0].mediaType).toBe('video');
  });

  it('defaults mediaType to "audio" for non-video enclosures', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({
      items: [makeRawItem({ enclosure: { url: 'https://cdn.example.com/ep.mp3', type: 'audio/mpeg' } })],
    }));
    const { episodes } = await parseFeed(URL);
    expect(episodes[0].mediaType).toBe('audio');
  });

  it('returns all episodes from the feed', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({
      items: [makeRawItem({ guid: 'ep-1' }), makeRawItem({ guid: 'ep-2' }), makeRawItem({ guid: 'ep-3' })],
    }));
    const { episodes } = await parseFeed(URL);
    expect(episodes).toHaveLength(3);
  });

  it('uses guid, then link, then title as episode guid fallbacks', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({ items: [makeRawItem({ guid: 'my-guid' })] }));
    expect((await parseFeed(URL)).episodes[0].guid).toBe('my-guid');

    mockParseURL.mockResolvedValue(makeRawFeed({ items: [makeRawItem({ guid: undefined, link: 'https://ep.link' })] }));
    expect((await parseFeed(URL)).episodes[0].guid).toBe('https://ep.link');
  });

  it('parses pubDate string into a Date', async () => {
    mockParseURL.mockResolvedValue(makeRawFeed({
      items: [makeRawItem({ pubDate: 'Mon, 15 Jan 2024 12:00:00 +0000' })],
    }));
    const { episodes } = await parseFeed(URL);
    expect(episodes[0].pubDate).toBeInstanceOf(Date);
    expect(episodes[0].pubDate.getFullYear()).toBe(2024);
  });

  describe('description fallbacks', () => {
    it('uses content first', async () => {
      mockParseURL.mockResolvedValue(makeRawFeed({
        items: [makeRawItem({ content: 'Full content', contentSnippet: 'Snippet', 'itunes:summary': 'Summary' })],
      }));
      expect((await parseFeed(URL)).episodes[0].description).toBe('Full content');
    });

    it('falls back to contentSnippet when content is absent', async () => {
      mockParseURL.mockResolvedValue(makeRawFeed({
        items: [makeRawItem({ contentSnippet: 'Snippet', 'itunes:summary': 'Summary' })],
      }));
      expect((await parseFeed(URL)).episodes[0].description).toBe('Snippet');
    });

    it('falls back to itunes:summary when neither content nor snippet is present', async () => {
      mockParseURL.mockResolvedValue(makeRawFeed({
        items: [makeRawItem({ 'itunes:summary': 'Summary' })],
      }));
      expect((await parseFeed(URL)).episodes[0].description).toBe('Summary');
    });

    it('returns null when no description source is present', async () => {
      mockParseURL.mockResolvedValue(makeRawFeed({ items: [makeRawItem()] }));
      expect((await parseFeed(URL)).episodes[0].description).toBeNull();
    });
  });

  describe('duration parsing', () => {
    async function duration(raw: unknown) {
      mockParseURL.mockResolvedValue(makeRawFeed({
        items: [makeRawItem({ 'itunes:duration': raw })],
      }));
      return (await parseFeed(URL)).episodes[0].duration;
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
