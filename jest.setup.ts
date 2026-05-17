import '@testing-library/jest-dom';
import { db, ensureSingletons } from '@/lib/db';

beforeEach(async () => {
  await db.chatMessage.deleteMany();
  await db.queueItem.deleteMany();
  await db.playbackState.deleteMany();
  await db.episode.deleteMany();
  await db.podcast.deleteMany();
  await db.settings.deleteMany();
  await ensureSingletons();
});
