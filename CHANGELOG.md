# Changelog

## [Unreleased]

### Fixed
- Dragged episode rows in All Podcasts view now have a solid white background so content doesn't bleed through while dragging
- Drag-and-drop reorder in All Podcasts view no longer flashes the old order after a drop — list updates optimistically before the server round-trip completes
- Mark as Played, Favorite, and other episode actions now reflect instantly in the UI; server sync and SSE propagation to other clients happen in the background
- Episode image caching removed — episodes now inherit the podcast's cached image, avoiding disk bloat and Next.js Image domain-whitelist issues
- Fixed refresh logic that was marking all newly-fetched episodes as unplayed; only the single newest episode is now marked unplayed on refresh
- Fixed settings and episode detail dialogs closing when interacting with `<select>` dropdowns
- Fixed modal dialogs rendering at top-left instead of centered (Tailwind preflight resets `margin: 0` on `<dialog>`)
- Fixed OPML import crash when a feed's image is declared via `<itunes:image href="..."/>` (xml2js wraps attributes in a nested object)
- Fixed unsubscribing from a podcast not immediately removing its episodes from the All Podcasts view
- Added "Tap to hear" button for new visitors when autoplay is blocked by the browser

### Added
- Episode audio served through `/api/episodes/[id]/audio`: streams the locally-downloaded file when available (with range-request support for seeking), falls back to a redirect to the remote RSS URL otherwise
- "Episodes to keep" now manages downloaded files on disk rather than deleting database records; only applies when Default Playback is set to Download First
- All Podcasts toolbar now shows total playback time of the unplayed queue in `[hh:mm:ss]` format next to the episode count (hidden when total is zero or all durations are unknown)
- iTunes podcast search: search button in the LeftPane footer opens a modal dialog backed by the iTunes Search API; results show artwork, title, author, and genre with a Subscribe button
- Pino structured logging throughout the server (`lib/logger.ts`), with pino-pretty output in development
- Podcast image preserved on refresh: if the remote image download fails during a feed refresh, the existing cached image is kept rather than overwritten with a broken URL
- 60-day rule: if the newest episode in a newly-imported or refreshed feed is more than 60 days old, all episodes are marked as played on arrival
- Guard against pruned episodes reappearing as unplayed: episodes older than the most-recent stored pubDate are never marked unplayed on re-import
- Dynamic page title reflects the currently playing episode (`<Episode> - <Podcast>`) and reverts to "Podhomme" when nothing is loaded
- Play/pause button in TopBar is disabled when no episode has been loaded
- BeardedSpice next/previous now skip forward/back 30s/15s (matching the TopBar buttons) rather than advancing tracks
- iTunes podcast search dialog
- All `<img>` tags replaced with Next.js `<Image />` for automatic optimisation
- Initial application scaffold
- Prisma schema with Podcast, Episode, QueueItem, PlaybackState, and Settings models (SQLite)
- SSE infrastructure for real-time state sync across all connected browsers
- Podcast CRUD API (add by RSS URL, update, delete/unsubscribe)
- RSS feed parser with iTunes namespace support (title, author, image, type, duration)
- OPML import endpoint for bulk subscription import
- Episode API (list with filters, mark played/unplayed, mark favorited/unfavorited)
- Queue API for the "All Podcasts" ordered episode list with drag-and-drop reorder
- Playback API (load, play, pause, seek, next, prev, sync) with live position calculation
- Auto-advance logic: advances to next episode based on playback context (all, podcast, favorites)
- Serial/Episodic podcast type support with per-podcast override
- Favorites: star episodes, dedicated sidebar view sorted by date favorited
- TopBar with transport controls (play/pause, skip ±15/30s, prev/next), progress bar, now playing info
- Split-pane layout: LeftPane (podcast list, All Podcasts, Favorites) + RightPane views
- AllPodcastsView with drag-and-drop reorder and date sort toggle
- PodcastView with metadata header, episode list, type override, refresh, and unsubscribe
- FavoritesView
- EpisodeRow with play, mark played, favorite, and download actions
- EpisodeDetail modal dialog
- Settings dialog (refresh frequency, episodes to keep, default playback, download location)
- BeardedSpice MediaStrategy (`public/beardedspice.js`) with `window.podhomme` API
- Background worker process for scheduled feed refresh
- PM2 ecosystem config (`ecosystem.config.js`) for web + worker processes
