import Parser from 'rss-parser';
import { XMLParser } from 'fast-xml-parser';
import { USER_AGENT } from '@/lib/user-agent';

type FeedEpisode = {
  guid: string;
  title: string;
  description: string | null;
  audioUrl: string;
  mediaType: string;
  imageUrl: string | null;
  duration: number | null;
  pubDate: Date;
};

type FeedData = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  siteUrl: string | null;
  author: string | null;
  type: string;
  episodes: FeedEpisode[];
};

export type ParseFeedResult =
  | { notModified: true }
  | { notModified: false; feed: FeedData; etag: string | null; lastModified: string | null };

const parser = new Parser({
  customFields: {
    feed: ['itunes:author', 'itunes:image', 'itunes:type'] as string[],
    item: ['itunes:duration', 'itunes:image', 'itunes:summary'] as string[],
  },
  requestOptions: {
    headers: { 'User-Agent': USER_AGENT },
  },
});

function extractImage(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.href === 'string') return o.href;
    if (typeof o.url === 'string') return o.url;
    // xml2js wraps attributes as { '$': { href: '...' } }
    const attrs = o['$'];
    if (attrs && typeof attrs === 'object') {
      const a = attrs as Record<string, unknown>;
      if (typeof a.href === 'string') return a.href;
      if (typeof a.url === 'string') return a.url;
    }
  }
  return null;
}

function parseDuration(raw: string | number | null | undefined): number | null {
  if (!raw) return null;
  if (typeof raw === 'number') return Math.floor(raw);
  const parts = raw.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Math.floor(Number(raw)) || null;
}

function extractEnclosureUrl(
  item: Parser.Item,
): { url: string; mediaType: string } | null {
  const enc = item.enclosure;
  if (!enc?.url) return null;
  const mediaType = enc.type?.startsWith('video/') ? 'video' : 'audio';
  return { url: enc.url, mediaType };
}

export async function parseFeed(
  url: string,
  cache?: { etag?: string | null; lastModified?: string | null },
): Promise<ParseFeedResult> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (cache?.etag) headers['If-None-Match'] = cache.etag;
  if (cache?.lastModified) headers['If-Modified-Since'] = cache.lastModified;

  const res = await fetch(url, { headers });

  if (res.status === 304) return { notModified: true };

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  const etag = res.headers.get('etag');
  const lastModified = res.headers.get('last-modified');

  const f = feed as any;
  const imageUrl =
    extractImage(f['itunes:image']) || extractImage(feed.image) || null;

  const type =
    ((f['itunes:type'] as string) || 'episodic').toLowerCase() === 'serial'
      ? 'serial'
      : 'episodic';

  const episodes: FeedEpisode[] = (feed.items ?? [])
    .map((item) => {
      const enclosure = extractEnclosureUrl(item);
      if (!enclosure) return null;

      const it = item as any;
      const itemImage = extractImage(it['itunes:image']);

      return {
        guid: item.guid || item.link || item.title || String(Date.now()),
        title: item.title || 'Untitled',
        description:
          item.content || item.contentSnippet || it['itunes:summary'] || null,
        audioUrl: enclosure.url,
        mediaType: enclosure.mediaType,
        imageUrl: itemImage,
        duration: parseDuration(it['itunes:duration']),
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      } satisfies FeedEpisode;
    })
    .filter((e): e is FeedEpisode => e !== null);

  return {
    notModified: false,
    feed: {
      title: feed.title || 'Untitled Podcast',
      description: feed.description || null,
      imageUrl,
      siteUrl: feed.link || null,
      author: f['itunes:author'] || feed.creator || null,
      type,
      episodes,
    },
    etag,
    lastModified,
  };
}

export type OpmlOutline = {
  title: string;
  feedUrl: string;
  siteUrl?: string | null;
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOpml(podcasts: OpmlOutline[]): string {
  const date = new Date().toUTCString();
  const outlines = podcasts
    .map((p) => {
      const title = xmlEscape(p.title);
      const xmlUrl = xmlEscape(p.feedUrl);
      const htmlUrl = p.siteUrl ? ` htmlUrl="${xmlEscape(p.siteUrl)}"` : '';
      return `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}"${htmlUrl}/>`;
    })
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>Podhomme Subscriptions</title>`,
    `    <dateCreated>${date}</dateCreated>`,
    '  </head>',
    '  <body>',
    outlines,
    '  </body>',
    '</opml>',
  ].join('\n');
}

export function parseOpml(xml: string): OpmlOutline[] {
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const doc = xmlParser.parse(xml);

  const outlines: OpmlOutline[] = [];

  function walk(node: any) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const xmlUrl = node['@_xmlUrl'];
    if (xmlUrl) {
      outlines.push({
        title: node['@_title'] || node['@_text'] || 'Untitled',
        feedUrl: xmlUrl,
      });
    }
    if (node.outline) walk(node.outline);
  }

  walk(doc?.opml?.body?.outline);
  return outlines;
}
