import { mkdir, writeFile } from 'fs/promises';
import { db } from '@/lib/db';
import logger from '@/lib/logger';
import path from 'path';
import { USER_AGENT } from '@/lib/user-agent';

const log = logger.child({ module: 'download' });

const inProgress = new Set<number>();

function resolveDownloadLocation(location: string): string {
  if (path.isAbsolute(location)) return location;
  return path.join(process.env.PODHOMME_DATA_DIR ?? process.cwd(), location);
}

export async function downloadEpisode(
  episodeId: number,
  audioUrl: string,
  downloadLocation: string,
) {
  if (inProgress.has(episodeId)) return;
  inProgress.add(episodeId);

  const resolvedLocation = resolveDownloadLocation(downloadLocation);

  log.info({ episodeId }, 'Downloading episode audio');
  try {
    await mkdir(resolvedLocation, { recursive: true });

    const res = await fetch(audioUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      log.warn(
        { episodeId, status: res.status },
        'Failed to fetch audio for download',
      );
      return;
    }

    const ext = audioUrl.split('?')[0].split('.').pop() || 'mp3';
    const filename = `${episodeId}.${ext}`;
    // turbopackIgnore tells the Turbopack file tracer not to follow this
    // dynamic path, which would otherwise cause it to trace the whole project.
    const filepath = path.join(
      /* turbopackIgnore: true */ resolvedLocation,
      filename,
    );

    const buffer = await res.arrayBuffer();
    await writeFile(filepath, Buffer.from(buffer));

    await db.episode.update({
      where: { id: episodeId },
      data: { downloadPath: filepath, fileSize: buffer.byteLength },
    });
    log.info(
      {
        episodeId,
        filepath,
        bytes: buffer.byteLength,
      },
      'Episode audio downloaded',
    );
  } catch (err) {
    log.error({ episodeId, err }, 'Failed to download episode audio');
  } finally {
    inProgress.delete(episodeId);
  }
}
