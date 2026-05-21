import { createServer } from 'http';
import path from 'path';
import { readFileSync } from 'fs';

const RSS_PORT = 4321;

export default async function globalSetup() {
  // Start a mock RSS + audio server so the add-podcast flow can fetch a real feed
  const feedXml = readFileSync(
    path.resolve(__dirname, 'fixtures/feed.xml'),
    'utf-8',
  );

  const server = createServer((req, res) => {
    if (req.url === '/feed.rss') {
      res.writeHead(200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
      });
      res.end(feedXml);
    } else {
      // Serve an empty valid response for any audio URL
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': '0',
      });
      res.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(RSS_PORT, resolve);
    server.on('error', reject);
  });

  // Return teardown function — Playwright calls this after all tests finish
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
