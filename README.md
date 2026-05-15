# Podhomme

A shared podcast player for the browser. Multiple people can open the same URL and control playback together in real time — play, pause, seek, and queue management all sync instantly across every connected tab.

## Features

- **Shared playback** — all connected browsers stay in sync via Server-Sent Events
- **Podcast subscriptions** — add feeds by RSS URL, search the iTunes catalog, or import an OPML file
- **Auto-advance** — when an episode ends, the next one plays automatically based on context (All Podcasts queue, individual podcast, or Favorites)
- **Serial / Episodic** — podcast episode order follows the feed's `<itunes:type>`, overridable per podcast
- **Favorites** — star episodes; accessible from the sidebar
- **Download first** — optionally download episode audio to the server and stream it locally rather than relying on remote URLs; configurable limit on how many files to keep per podcast
- **Mobile UI** — dedicated mobile layout served automatically based on user agent, installable as a PWA with a native headphones icon
- **Now Playing integration** — Media Session API exposes episode metadata, artwork, and transport controls to the macOS menu bar, iOS Control Center, and lock screen
- **Password protection** — optional single-password auth gating the entire app, configured via environment variable
- **BeardedSpice** — MediaStrategy exposes episode and podcast metadata so Airfoil can display Now Playing info for the current episode
- **Scheduled refresh** — feeds refresh automatically on a configurable schedule

## Tech Stack

- **Next.js 16** (App Router) + React 19
- **Tailwind CSS v4**
- **SQLite** via **Prisma 7**
- **Node.js** + **tsx** (worker process)
- **Bun** runtime (web server)
- **PM2** process management

## Setup

### Prerequisites

- [Bun](https://bun.sh)
- [Node.js](https://nodejs.org) (for the background worker)
- [PM2](https://pm2.keymetrics.io) (`npm install -g pm2`)

### Development

```bash
yarn install
npx prisma migrate dev
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
yarn install
npx prisma migrate deploy
yarn build
pm2 start ecosystem.config.js
```

The web server runs on port 3000. The worker process handles scheduled feed refreshes.

## Authentication

Podhomme has no user accounts, but you can restrict access with a single shared password:

```bash
# .env
APP_PASSWORD=your-password-here
WORKER_SECRET=some-long-random-string
```

When `APP_PASSWORD` is set, every page and API route requires a valid session cookie. The login page at `/login` is the only public path. If `APP_PASSWORD` is not set, the app is open to anyone who can reach it (useful for local development).

Changing the password invalidates all existing sessions — users will be prompted to log in again.

`WORKER_SECRET` allows the background refresh worker to call the app's API without a session cookie. It should be a long random string, separate from `APP_PASSWORD`. Both variables should be set together whenever auth is enabled.

## BeardedSpice / Airfoil Integration

BeardedSpice is used here not for media key control, but as a bridge to get Now Playing metadata (episode title, podcast name, artwork) from the browser into Airfoil.

1. Download `public/beardedspice.js` from the running app at `http://localhost:3000/beardedspice.js`
2. In BeardedSpice preferences → Strategies → Add custom strategy
3. Select the downloaded file
4. BeardedSpice will read the current episode metadata from the page and expose it to Airfoil as Now Playing info

## Settings

Accessible via the gear icon in the top bar:

| Setting | Options |
|---|---|
| Refresh frequency | 30m, 1h, 3h, 12h, 1 day |
| Episodes to keep | 1, 2, 3, 5, all unplayed, all |
| Default playback | Stream or download first |
| Download location | Server filesystem path |
