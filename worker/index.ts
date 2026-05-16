import '../envConfig';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../app/generated/prisma/client';
import pino from 'pino';

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
    : undefined,
}).child({ module: 'worker' });

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url });
const db = new PrismaClient({ adapter });

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

async function triggerRefresh() {
  log.info({ url: `${WEB_URL}/api/podcasts/refresh` }, 'Triggering scheduled refresh');
  try {
    await fetch(`${WEB_URL}/api/podcasts/refresh`, {
      method: 'POST',
      headers: process.env.WORKER_SECRET
        ? { 'x-worker-secret': process.env.WORKER_SECRET }
        : {},
    });
    log.info('Refresh triggered successfully');
  } catch (err) {
    log.error({ err }, 'Failed to trigger refresh');
  }
}

async function main() {
  log.info('Worker starting');
  await db.settings.upsert({
 where: { id: 1 }, create: { id: 1 }, update: {}, 
});
  await db.playbackState.upsert({
 where: { id: 1 }, create: { id: 1 }, update: {}, 
});
  log.info('Singletons initialised');

  let lastRefresh = 0;

  while (true) {
    const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
    const intervalMs = settings.refreshFrequency * 60 * 1000;
    const now = Date.now();

    if (now - lastRefresh >= intervalMs) {
      lastRefresh = now;
      log.info({ refreshFrequency: settings.refreshFrequency }, `Next refresh in ${settings.refreshFrequency} minutes`);
      await triggerRefresh();
    }

    await new Promise(resolve => setTimeout(resolve, 60_000));
  }
}

main().catch(err => {
  log.fatal({ err }, 'Worker crashed');
  process.exit(1);
});
