-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Episode" (
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
    "resumeAt" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Episode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("audioUrl", "createdAt", "description", "downloadPath", "duration", "favorited", "favoritedAt", "fileSize", "guid", "id", "imageUrl", "played", "playedAt", "podcastId", "pubDate", "title") SELECT "audioUrl", "createdAt", "description", "downloadPath", "duration", "favorited", "favoritedAt", "fileSize", "guid", "id", "imageUrl", "played", "playedAt", "podcastId", "pubDate", "title" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
CREATE UNIQUE INDEX "Episode_podcastId_guid_key" ON "Episode"("podcastId", "guid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
