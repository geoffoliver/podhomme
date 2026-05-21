// electron-builder afterPack hook.
// Copies the Next.js standalone directory into the app's Resources folder after
// packaging, then replaces any native .node files inside standalone with the
// arch-correct versions that electron-builder rebuilt for the target platform.
const fs = require('fs');
const path = require('path');

function findFiles(dir, name, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, name, results);
    else if (entry.name === name) results.push(full);
  }
  return results;
}

module.exports = async function afterPack({ appOutDir, packager }) {
  const appName = packager.appInfo.productFilename;
  const isMac = packager.platform.name === 'mac';

  let resourcesPath;
  switch (packager.platform.name) {
    case 'mac':
      resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
      break;
    case 'linux':
    case 'windows':
    default:
      resourcesPath = path.join(appOutDir, 'resources');
  }

  // Bundle the Airfoil helper app on macOS
  if (isMac) {
    const helperSrc = path.join(__dirname, '..', 'electron-build', 'AirfoilHelper.app');
    const helperDst = path.join(appOutDir, `${appName}.app`, 'Contents', 'Helpers', 'AirfoilHelper.app');
    if (fs.existsSync(helperSrc)) {
      console.log(`  • bundling AirfoilHelper.app → Contents/Helpers/`);
      fs.cpSync(helperSrc, helperDst, { recursive: true });
    } else {
      console.warn('  ! AirfoilHelper.app not found — run `yarn electron:build-helper` first');
    }
  }

  const src = path.join(__dirname, '..', '.next', 'standalone');
  const dst = path.join(resourcesPath, 'standalone');

  console.log(`  • copying Next.js standalone → ${dst}`);
  fs.cpSync(src, dst, { recursive: true, dereference: true });

  // electron-builder rebuilds native modules for the target arch before
  // afterPack runs, but only in the root node_modules. The standalone
  // directory carries copies built for the dev machine's arch. Replace every
  // better_sqlite3.node inside standalone with the freshly rebuilt one so the
  // correct arch is used at runtime.
  const rebuiltNode = path.join(
    resourcesPath,
    'app.asar.unpacked', 'node_modules', 'better-sqlite3',
    'build', 'Release', 'better_sqlite3.node',
  );

  if (fs.existsSync(rebuiltNode)) {
    const targets = findFiles(dst, 'better_sqlite3.node');
    for (const target of targets) {
      console.log(`  • replacing ${path.relative(dst, target)} with rebuilt binary`);
      fs.copyFileSync(rebuiltNode, target);
    }
  } else {
    console.warn(`  ! rebuilt binary not found at ${rebuiltNode} — standalone may use wrong arch`);
  }
};
