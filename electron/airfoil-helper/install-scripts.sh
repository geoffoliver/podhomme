#!/usr/bin/env bash
set -euo pipefail

# Compiles the Airfoil AppleScript integration files and installs them into
# Airfoil's scripts directories. Must be run while Podhomme (or the standalone
# AirfoilHelper.app) is running, because osacompile resolves property codes
# from the app's live scripting definition.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TRACK_TITLES_SRC="${SCRIPT_DIR}/Scripts/TrackTitles/com.podhomme.airfoil-helper.applescript"
REMOTE_CTRL_SRC="${SCRIPT_DIR}/Scripts/RemoteControl/dacp.com.podhomme.airfoil-helper.applescript"

AIRFOIL_SUPPORT="${HOME}/Library/Application Support/Airfoil"
TRACK_TITLES_DST="${AIRFOIL_SUPPORT}/TrackTitles/com.podhomme.airfoil-helper.scpt"
REMOTE_CTRL_DST="${AIRFOIL_SUPPORT}/RemoteControl/dacp.com.podhomme.airfoil-helper.scpt"

# ── Check platform ────────────────────────────────────────────────────────────

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: this script is macOS only." >&2
  exit 1
fi

# ── Ensure AirfoilHelper is running ──────────────────────────────────────────

if ! pgrep -x AirfoilHelper > /dev/null 2>&1; then
  echo "AirfoilHelper is not running. Attempting to start it..."

  HELPER_APP=""
  # Try the dev build first, then a standard install location
  for candidate in \
    "${REPO_ROOT}/electron-build/AirfoilHelper.app" \
    "/Applications/Podhomme.app/Contents/Helpers/AirfoilHelper.app"
  do
    if [[ -d "${candidate}" ]]; then
      HELPER_APP="${candidate}"
      break
    fi
  done

  if [[ -z "${HELPER_APP}" ]]; then
    echo "Error: could not find AirfoilHelper.app." >&2
    echo "Start Podhomme, or run 'yarn electron:build-helper' first." >&2
    exit 1
  fi

  open -na "${HELPER_APP}"

  echo -n "Waiting for AirfoilHelper to start"
  for i in $(seq 1 20); do
    if pgrep -x AirfoilHelper > /dev/null 2>&1; then
      echo " ready."
      break
    fi
    echo -n "."
    sleep 0.5
    if [[ $i -eq 20 ]]; then
      echo ""
      echo "Error: AirfoilHelper did not start in time." >&2
      exit 1
    fi
  done
fi

# ── Create destination directories ───────────────────────────────────────────

mkdir -p "${AIRFOIL_SUPPORT}/TrackTitles"
mkdir -p "${AIRFOIL_SUPPORT}/RemoteControl"

# ── Compile and install ───────────────────────────────────────────────────────

echo "Compiling TrackTitles script..."
osacompile -o "${TRACK_TITLES_DST}" "${TRACK_TITLES_SRC}"
echo "  → ${TRACK_TITLES_DST}"

echo "Compiling RemoteControl script..."
osacompile -o "${REMOTE_CTRL_DST}" "${REMOTE_CTRL_SRC}"
echo "  → ${REMOTE_CTRL_DST}"

echo ""
echo "Done. Reload Airfoil's source list (or restart Airfoil) to pick up the changes."
