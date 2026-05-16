import { createReadStream } from 'fs';
import { db } from '@/lib/db';
import { downloadEpisode } from '@/lib/download';
import path from 'path';
import { stat } from 'fs/promises';

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg; codecs=opus',
    flac: 'audio/flac',
    wav: 'audio/wav',
  };
  return map[ext] ?? 'audio/mpeg';
}

export async function GET(request: Request, ctx: RouteContext<'/api/episodes/[id]/audio'>) {
  const { id } = await ctx.params;
  const episodeId = Number(id);

  const episode = await db.episode.findUnique({
    where: { id: episodeId },
    select: { audioUrl: true, downloadPath: true },
  });
  if (!episode) return new Response('Not found', { status: 404 });

  if (episode.downloadPath) {
    try {
      const stats = await stat(episode.downloadPath);
      const fileSize = stats.size;
      const type = mimeType(episode.downloadPath);
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
          const length = end - start + 1;
          const nodeStream = createReadStream(episode.downloadPath, { start, end });
          const body = new ReadableStream({
            start(controller) {
              nodeStream.on('data', chunk => controller.enqueue(chunk));
              nodeStream.on('end', () => controller.close());
              nodeStream.on('error', err => controller.error(err));
            },
            cancel() { nodeStream.destroy(); },
          });
          return new Response(body, {
            status: 206,
            headers: {
              'Content-Type': type,
              'Content-Length': String(length),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
            },
          });
        }
      }

      const nodeStream = createReadStream(episode.downloadPath);
      const body = new ReadableStream({
        start(controller) {
          nodeStream.on('data', chunk => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', err => controller.error(err));
        },
        cancel() { nodeStream.destroy(); },
      });
      return new Response(body, {
        headers: {
          'Content-Type': type,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch {
      // File missing or unreadable — fall through to redirect
    }
  }

  // No local file — if download mode is on, fetch in the background so next play is local
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings?.defaultPlayback === 'download') {
    downloadEpisode(episodeId, episode.audioUrl, settings.downloadLocation).catch(() => {});
  }

  return Response.redirect(episode.audioUrl, 302);
}
