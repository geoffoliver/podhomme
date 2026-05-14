# Podhomme

A shared podcast player for the browser. Multiple people can open the same URL and control playback together in real time — play, pause, seek, and queue management all sync instantly across every connected tab.

## Features

- **Shared playback** — all connected browsers stay in sync via Server-Sent Events
- **Podcast subscriptions** — add feeds by RSS URL or import an OPML file
- **Auto-advance** — when an episode ends, the next one plays automatically based on context (All Podcasts queue, individual podcast, or Favorites)
- **Serial / Episodic** — podcast episode order follows the feed's `<itunes:type>`, overridable per podcast
- **Favorites** — star episodes; accessible from the sidebar and controllable via media keys
- **BeardedSpice** — full MediaStrategy for controlling playback via macOS media keys
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

## BeardedSpice Integration

1. Download `public/beardedspice.js` from the running app at `http://localhost:3000/beardedspice.js`
2. In BeardedSpice preferences → Strategies → Add custom strategy
3. Select the downloaded file

Media keys will then control playback, and Now Playing info will show the current episode.

## Settings

Accessible via the gear icon in the top bar:

| Setting | Options |
|---|---|
| Refresh frequency | 30m, 1h, 3h, 12h, 1 day |
| Episodes to keep | 1, 2, 3, 5, all unplayed, all |
| Default playback | Stream or download first |
| Download location | Server filesystem path |
