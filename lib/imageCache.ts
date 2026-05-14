import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import logger from '@/lib/logger'

const log = logger.child({ module: 'imageCache' })

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const PODCAST_IMAGE_DIR = path.join(PUBLIC_DIR, 'images', 'podcasts')

async function cacheImage(url: string, dir: string, filename: string, label: string): Promise<string> {
  if (url.startsWith('/')) return url  // already cached

  log.debug({ label, url }, 'Downloading image')

  try {
    await mkdir(dir, { recursive: true })

    const res = await fetch(url)
    if (!res.ok) {
      log.warn({ label, url, status: res.status, statusText: res.statusText }, 'Failed to fetch image, falling back to remote URL')
      return url
    }

    const contentType = res.headers.get('content-type') ?? ''
    let ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg'
    if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('gif')) ext = 'gif'
    else if (contentType.includes('webp')) ext = 'webp'
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg'
    if (ext === 'jpeg') ext = 'jpg'

    const file = `${filename}.${ext}`
    const buffer = await res.arrayBuffer()
    await writeFile(path.join(dir, file), Buffer.from(buffer))

    const localPath = `/${path.relative(PUBLIC_DIR, path.join(dir, file))}`
    log.info({ label, localPath }, 'Image cached')
    return localPath
  } catch (err) {
    log.error({ label, url, err }, 'Error caching image, falling back to remote URL')
    return url
  }
}

export async function cachePodcastImage(url: string | null, podcastId: number): Promise<string | null> {
  if (!url) return null
  return cacheImage(url, PODCAST_IMAGE_DIR, String(podcastId), `podcast:${podcastId}`)
}
