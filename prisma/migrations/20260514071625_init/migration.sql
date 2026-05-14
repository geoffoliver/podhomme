-- CreateTable
CREATE TABLE "Podcast" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "feedUrl" TEXT NOT NULL,
    "siteUrl" TEXT,
    "author" TEXT,
    "type" TEXT NOT NULL DEFAULT 'episodic',
    "typeOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastRefreshedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "podcastId" INTEGER NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audioUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "duration" INTEGER,
    "pubDate" DATETIME NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "playedAt" DATETIME,
    "favorited" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" DATETIME,
    "downloadPath" TEXT,
    "fileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Episode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "episodeId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "QueueItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaybackState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "episodeId" INTEGER,
    "position" REAL NOT NULL DEFAULT 0,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "context" TEXT NOT NULL DEFAULT 'all',
    "contextPodcastId" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaybackState_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "refreshFrequency" INTEGER NOT NULL DEFAULT 60,
    "episodesToKeep" TEXT NOT NULL DEFAULT 'all_unplayed',
    "defaultPlayback" TEXT NOT NULL DEFAULT 'stream',
    "downloadLocation" TEXT NOT NULL DEFAULT './downloads'
);

-- CreateIndex
CREATE UNIQUE INDEX "Podcast_feedUrl_key" ON "Podcast"("feedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_podcastId_guid_key" ON "Episode"("podcastId", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_episodeId_key" ON "QueueItem"("episodeId");
