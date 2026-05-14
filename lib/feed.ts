import Parser from 'rss-parser'
import { XMLParser } from 'fast-xml-parser'

type FeedEpisode = {
  guid: string
  title: string
  description: string | null
  audioUrl: string
  imageUrl: string | null
  duration: number | null
  pubDate: Date
}

type FeedData = {
  title: string
  description: string | null
  imageUrl: string | null
  siteUrl: string | null
  author: string | null
  type: string
  episodes: FeedEpisode[]
}

const parser = new Parser({
  customFields: {
    feed: ['itunes:author', 'itunes:image', 'itunes:type'] as string[],
    item: ['itunes:duration', 'itunes:image', 'itunes:summary'] as string[],
  },
})

function extractImage(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.href === 'string') return o.href
    if (typeof o.url === 'string') return o.url
    // xml2js wraps attributes as { '$': { href: '...' } }
    const attrs = o['$']
    if (attrs && typeof attrs === 'object') {
      const a = attrs as Record<string, unknown>
      if (typeof a.href === 'string') return a.href
      if (typeof a.url === 'string') return a.url
    }
  }
  return null
}

function parseDuration(raw: string | number | null | undefined): number | null {
  if (!raw) return null
  if (typeof raw === 'number') return Math.floor(raw)
  const parts = raw.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return Math.floor(Number(raw)) || null
}

function extractEnclosureUrl(item: Parser.Item): string | null {
  const enc = item.enclosure
  if (enc?.url) return enc.url
  return null
}

export async function parseFeed(url: string): Promise<FeedData> {
  const feed = await parser.parseURL(url)

  const f = feed as any
  const imageUrl = extractImage(f['itunes:image']) || extractImage(feed.image) || null

  const type =
    ((f['itunes:type'] as string) || 'episodic').toLowerCase() === 'serial'
      ? 'serial'
      : 'episodic'

  const episodes: FeedEpisode[] = (feed.items ?? [])
    .map((item) => {
      const audioUrl = extractEnclosureUrl(item)
      if (!audioUrl) return null

      const it = item as any
      const itemImage = extractImage(it['itunes:image'])

      return {
        guid: item.guid || item.link || item.title || String(Date.now()),
        title: item.title || 'Untitled',
        description: item.content || item.contentSnippet || it['itunes:summary'] || null,
        audioUrl,
        imageUrl: itemImage,
        duration: parseDuration(it['itunes:duration']),
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      } satisfies FeedEpisode
    })
    .filter((e): e is FeedEpisode => e !== null)

  return {
    title: feed.title || 'Untitled Podcast',
    description: feed.description || null,
    imageUrl,
    siteUrl: feed.link || null,
    author: f['itunes:author'] || feed.creator || null,
    type,
    episodes,
  }
}

export type OpmlOutline = {
  title: string
  feedUrl: string
}

export function parseOpml(xml: string): OpmlOutline[] {
  const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = xmlParser.parse(xml)

  const outlines: OpmlOutline[] = []

  function walk(node: any) {
    if (!node) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    const xmlUrl = node['@_xmlUrl']
    if (xmlUrl) {
      outlines.push({
        title: node['@_title'] || node['@_text'] || 'Untitled',
        feedUrl: xmlUrl,
      })
    }
    if (node.outline) walk(node.outline)
  }

  walk(doc?.opml?.body?.outline)
  return outlines
}
