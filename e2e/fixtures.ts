import { test as base, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

export const FEED_URL = 'http://localhost:4321/feed.rss';

const DB_PATH = path.resolve(__dirname, '../prisma/e2e.db');

// Helpers that talk to SQLite directly — avoids the Prisma ESM/CJS conflict
// in Playwright's test runner.

export type Db = {
  createPodcast(data: { title: string; feedUrl: string; type?: string }): {
    id: number;
  };
  createEpisode(data: {
    podcastId: number;
    guid: string;
    title: string;
    audioUrl: string;
    pubDate: Date;
    duration?: number;
    played?: boolean;
    favorited?: boolean;
    favoritedAt?: Date;
    downloadPath?: string;
  }): { id: number };
  createQueueItem(episodeId: number, position: number): void;
};

function openDb(): Database.Database {
  return new Database(DB_PATH);
}

function makeDb(sqlite: Database.Database): Db {
  return {
    createPodcast({
      title, feedUrl, type = 'episodic', 
    }) {
      const stmt = sqlite.prepare(
        `INSERT INTO Podcast (title, feedUrl, type, createdAt, updatedAt)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
      );
      const result = stmt.run(title, feedUrl, type);
      return { id: result.lastInsertRowid as number };
    },

    createEpisode({
      podcastId,
      guid,
      title,
      audioUrl,
      pubDate,
      duration = null,
      played = false,
      favorited = false,
      favoritedAt = null,
      downloadPath = null,
    }) {
      const stmt = sqlite.prepare(
        `INSERT INTO Episode (podcastId, guid, title, audioUrl, pubDate, duration, played, favorited, favoritedAt, downloadPath, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      );
      const result = stmt.run(
        podcastId,
        guid,
        title,
        audioUrl,
        pubDate.toISOString(),
        duration,
        played ? 1 : 0,
        favorited ? 1 : 0,
        favoritedAt ? favoritedAt.toISOString() : null,
        downloadPath,
      );
      return { id: result.lastInsertRowid as number };
    },

    createQueueItem(episodeId, position) {
      sqlite
        .prepare('INSERT INTO QueueItem (episodeId, position) VALUES (?, ?)')
        .run(episodeId, position);
    },
  };
}

function resetDb(sqlite: Database.Database) {
  sqlite.exec(`
    DELETE FROM QueueItem;
    DELETE FROM PlaybackState;
    DELETE FROM Episode;
    DELETE FROM Podcast;
    DELETE FROM Settings;
    INSERT OR IGNORE INTO PlaybackState (id, episodeId, position, isPlaying, context, updatedAt)
      VALUES (1, NULL, 0, 0, 'all', datetime('now'));
    INSERT OR IGNORE INTO Settings (id, refreshFrequency, episodesToKeep, defaultPlayback, downloadLocation)
      VALUES (1, 60, 'all_unplayed', 'stream', './downloads');
  `);
}

export const test = base.extend<{ db: Db }>({
  db: async ({}, use) => {
    const sqlite = openDb();
    resetDb(sqlite);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(makeDb(sqlite));
    sqlite.close();
  },
});

export { expect };
