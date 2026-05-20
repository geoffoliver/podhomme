#!/usr/bin/env node
// Prepares the Next.js standalone output for Electron packaging.
const fs = require('fs');
const path = require('path');

const standalone = path.join('.next', 'standalone');

// Copy assets that standalone doesn't include automatically.
fs.cpSync(
  path.join('.next', 'static'),
  path.join(standalone, '.next', 'static'),
  { recursive: true },
);
fs.cpSync('public', path.join(standalone, 'public'), { recursive: true });

// Turbopack references native/server-side modules via hash-based symlinks in
// .next/node_modules/ (e.g. better-sqlite3-90e2652d1716b047 → ../../node_modules/better-sqlite3).
// codesign --verify --strict rejects symlinks that point outside the bundle, so
// replace every symlink in that directory with a real copy of its target.
function resolveSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink()) {
      const resolved = fs.realpathSync(entryPath);
      fs.rmSync(entryPath, { recursive: true, force: true });
      fs.cpSync(resolved, entryPath, { recursive: true });
      console.log(`  • resolved symlink ${path.relative(standalone, entryPath)}`);
    } else if (stat.isDirectory()) {
      resolveSymlinks(entryPath);
    }
  }
}

resolveSymlinks(path.join(standalone, '.next', 'node_modules'));
