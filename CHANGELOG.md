# Changelog

## [Unreleased]

### Added
- **BeardedSpice strategy served dynamically** — `/api/beardedspice` now returns the strategy JS with `WEB_URL` from the environment substituted in; the predicate matches on the tab URL instead of the page title so it keeps working while tracks are playing. Download from `/api/beardedspice` and install as a custom strategy in BeardedSpice
- **Video podcast support** — episodes with `video/*` enclosure MIME types play in a collapsible video panel below the top bar (desktop) or in the Now Playing overlay (mobile); both surfaces have a fullscreen button; all existing transport controls work the same way
- **Podcast links** — podcast detail header now shows a Website link (from the feed's `<link>`) and an RSS Feed link; both open in a new tab
- **Dark mode** — all desktop and mobile UI surfaces respond to `prefers-color-scheme: dark`; buttons, inputs, dialogs, toolbars, progress bars, now-playing overlay, and menus all invert correctly
- **Password authentication** — set `APP_PASSWORD` in `.env` to require a password before accessing the app; skipped entirely if the variable is not set. Cookie is valid for one year; changing the password invalidates all existing sessions automatically
- **Worker secret** — set `WORKER_SECRET` in `.env`; the background refresh worker sends it as an `x-worker-secret` header so its requests bypass cookie auth without needing a session
- **Mobile PWA icon** — `app/apple-icon.tsx` generates a proper 180×180 PNG via `ImageResponse` so iOS correctly uses the headphones icon when adding to home screen (iOS ignores SVG apple-touch-icons)
- **macOS / iOS Now Playing integration** — Media Session API wired into `PlaybackContext`; episode title, podcast name, author, and artwork now appear in the macOS menu bar Now Playing widget, iOS Control Center, and lock screen. Play/pause, previous/next, seek forward/back, and scrubber all work from the OS controls
- **Mobile queue reordering** — "Move up" / "Move down" actions in the ⋯ menu on each queue row
- **Download-first on-demand** — when an episode without a local file is played under the "Download first" setting, the audio route kicks off a background download immediately so the next play serves the file locally; an in-progress guard prevents duplicate downloads

### Fixed
- Mobile bottom bar (MiniPlayer + BottomTabs) no longer drifts upward — Shell now locks `overflow: hidden` on `<html>` and `<body>` while mounted, preventing iOS Safari from rubber-banding the document layer behind the fixed shell
- NowPlaying overlay close button was hidden behind the iOS status bar — top bar now uses `padding-top: max(0.75rem, env(safe-area-inset-top))`
- Mobile header top padding replaced hardcoded `pt-12` with `padding-top: max(1rem, env(safe-area-inset-top))` so it correctly tracks the real safe area after adding `viewportFit: 'cover'`
- Added `viewport-fit: cover` to viewport metadata so `env(safe-area-inset-bottom)` activates and the tab bar gap above the iPhone home indicator actually renders
- `MiniPlayer` and `BottomTabs` now have `flex-shrink: 0` and `touch-action: none` to prevent flex shrinking and browser scroll gestures from shifting the bottom bar
- Mobile login page was being rewritten to `/m` (showing the Queue screen) before the login form could render — `/login` is now excluded from the mobile rewrite in `proxy.ts`
- After login, providers were already mounted with empty state from the login-page load; replaced `router.push('/')` with `window.location.href = '/'` to force a full reload so all contexts re-fetch with the auth cookie present
- Podcast artwork in production (`/_next/image` returning "not a valid image") — removed local image caching entirely; podcast images now use the original remote RSS URLs and Next.js image optimisation handles caching in `.next/cache/images/`
- "Download first" setting was only downloading the single newest episode on refresh, not episodes loaded manually or episodes that existed before the setting was enabled; audio route now triggers a background download for any episode missing a local file when the setting is active
- Service worker registered in `app/providers.tsx` so the PWA install prompt works correctly

### Dragged episode rows in All Podcasts view now have a solid white background so content doesn't bleed through while dragging
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
