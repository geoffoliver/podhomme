#!/usr/bin/env node
// Compiles the Swift Airfoil helper into a macOS .app bundle at
// electron-build/AirfoilHelper.app. Only runs on macOS; exits cleanly elsewhere.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.platform !== 'darwin') {
  console.log('build-airfoil-helper: skipping (macOS only)');
  process.exit(0);
}

const root = path.join(__dirname, '..');
const helperSrc = path.join(root, 'electron', 'airfoil-helper');
const swiftSrc = path.join(helperSrc, 'Sources', 'main.swift');
const outApp = path.join(root, 'electron-build', 'AirfoilHelper.app');
const contentsDir = path.join(outApp, 'Contents');
const macosDir = path.join(contentsDir, 'MacOS');
const resourcesDir = path.join(contentsDir, 'Resources');

fs.mkdirSync(macosDir, { recursive: true });
fs.mkdirSync(resourcesDir, { recursive: true });

const binaryOut = path.join(macosDir, 'AirfoilHelper');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airfoil-helper-'));

try {
  console.log('Compiling AirfoilHelper (arm64)…');
  execSync(
    `swiftc "${swiftSrc}" -target arm64-apple-macos11.0 -framework Cocoa -O -o "${tmpDir}/AirfoilHelper_arm64"`,
    { stdio: 'inherit' },
  );

  console.log('Compiling AirfoilHelper (x86_64)…');
  execSync(
    `swiftc "${swiftSrc}" -target x86_64-apple-macos10.15 -framework Cocoa -O -o "${tmpDir}/AirfoilHelper_x86_64"`,
    { stdio: 'inherit' },
  );

  console.log('Creating universal binary…');
  execSync(
    `lipo -create "${tmpDir}/AirfoilHelper_arm64" "${tmpDir}/AirfoilHelper_x86_64" -output "${binaryOut}"`,
    { stdio: 'inherit' },
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Copy bundle resources
fs.copyFileSync(
  path.join(helperSrc, 'Resources', 'Info.plist'),
  path.join(contentsDir, 'Info.plist'),
);
fs.copyFileSync(
  path.join(helperSrc, 'Resources', 'AirfoilHelper.sdef'),
  path.join(resourcesDir, 'AirfoilHelper.sdef'),
);

// Copy Airfoil scripts into the bundle so users can find them inside the .app
const scriptsOut = path.join(resourcesDir, 'AirfoilScripts');
fs.cpSync(path.join(helperSrc, 'Scripts'), scriptsOut, { recursive: true });

console.log(`AirfoilHelper.app built → ${outApp}`);
