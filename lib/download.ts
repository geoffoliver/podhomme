import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import logger from '@/lib/logger'

const log = logger.child({ module: 'download' })

const inProgress = new Set<number>()

export async function downloadEpisode(episodeId: number, audioUrl: string, downloadLocation: string) {
  if (inProgress.has(episodeId)) return
  inProgress.add(episodeId)

  log.info({ episodeId }, 'Downloading episode audio')
  try {
    await mkdir(downloadLocation, { recursive: true })

    const res = await fetch(audioUrl)
    if (!res.ok) {
      log.warn({ episodeId, status: res.status }, 'Failed to fetch audio for download')
      return
    }

    const ext = audioUrl.split('?')[0].split('.').pop() || 'mp3'
    const filename = `${episodeId}.${ext}`
    const filepath = path.join(downloadLocation, filename)

    const buffer = await res.arrayBuffer()
    await writeFile(filepath, Buffer.from(buffer))

    await db.episode.update({
      where: { id: episodeId },
      data: { downloadPath: filepath, fileSize: buffer.byteLength },
    })
    log.info({ episodeId, filepath, bytes: buffer.byteLength }, 'Episode audio downloaded')
  } catch (err) {
    log.error({ episodeId, err }, 'Failed to download episode audio')
  } finally {
    inProgress.delete(episodeId)
  }
}
