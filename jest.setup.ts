import '@testing-library/jest-dom';

// DB setup only runs in the Node environment — jsdom tests (hooks, components)
// don't have access to the SQLite adapter anyway.
if (typeof window === 'undefined') {
  const { db, ensureSingletons } = require('@/lib/db');

  beforeEach(async () => {
    await db.chatMessage.deleteMany();
    await db.queueItem.deleteMany();
    await db.playbackState.deleteMany();
    await db.episode.deleteMany();
    await db.podcast.deleteMany();
    await db.settings.deleteMany();
    await ensureSingletons();
  });
}
