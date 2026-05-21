#!/usr/bin/env bash
set -euo pipefail

# Compiles the Airfoil AppleScript integration files and installs them into
# Airfoil's scripts directories. Must be run while Podhomme (or the standalone
# AirfoilHelper.app) is running, because osacompile resolves property codes
# from the app's live scripting definition.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TRACK_TITLES_SRC="${SCRIPT_DIR}/Scripts/TrackTitles/com.podhomme.airfoil-helper.applescript"
TRACK_TITLES_COMPILED="${SCRIPT_DIR}/Scripts/TrackTitles/com.podhomme.airfoil-helper.scpt"
REMOTE_CTRL_SRC="${SCRIPT_DIR}/Scripts/RemoteControl/dacp.com.podhomme.airfoil-helper.applescript"
REMOTE_CTRL_COMPILED="${SCRIPT_DIR}/Scripts/RemoteControl/dacp.com.podhomme.airfoil-helper.scpt"

AIRFOIL_SUPPORT="${HOME}/Library/Application Support/Airfoil"
TRACK_TITLES_DST="${AIRFOIL_SUPPORT}/TrackTitles/com.podhomme.airfoil-helper.scpt"
REMOTE_CTRL_DST="${AIRFOIL_SUPPORT}/RemoteControl/dacp.com.podhomme.airfoil-helper.scpt"

# ── Check platform ────────────────────────────────────────────────────────────

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: this script is macOS only." >&2
  exit 1
fi

# ── Create destination directories ───────────────────────────────────────────

mkdir -p "${AIRFOIL_SUPPORT}/TrackTitles"
mkdir -p "${AIRFOIL_SUPPORT}/RemoteControl"

# ── Install scripts ───────────────────────────────────────────────────────────
# Prefer pre-compiled .scpt files (built by yarn electron:build-helper or
# bundled inside Podhomme.app). Fall back to compiling from source, which
# requires AirfoilHelper to be running.

install_script() {
  local compiled="$1" src="$2" dst="$3" label="$4"

  if [[ -f "${compiled}" ]]; then
    echo "Copying ${label} script (pre-compiled)..."
    cp "${compiled}" "${dst}"
  else
    echo "Pre-compiled ${label} script not found — compiling from source..."
    ensure_helper_running
    osacompile -o "${dst}" "${src}"
  fi
  echo "  → ${dst}"
}

ensure_helper_running() {
  if pgrep -x AirfoilHelper > /dev/null 2>&1; then return; fi

  echo "AirfoilHelper is not running. Attempting to start it..."
  local HELPER_APP=""
  for candidate in \
    "${REPO_ROOT}/electron-build/AirfoilHelper.app" \
    "/Applications/Podhomme.app/Contents/Helpers/AirfoilHelper.app"
  do
    if [[ -d "${candidate}" ]]; then HELPER_APP="${candidate}"; break; fi
  done

  if [[ -z "${HELPER_APP}" ]]; then
    echo "Error: could not find AirfoilHelper.app." >&2
    echo "Start Podhomme, or run 'yarn electron:build-helper' first." >&2
    exit 1
  fi

  open -na "${HELPER_APP}"
  echo -n "Waiting for AirfoilHelper to start"
  for i in $(seq 1 20); do
    if pgrep -x AirfoilHelper > /dev/null 2>&1; then echo " ready."; return; fi
    echo -n "."; sleep 0.5
  done
  echo ""
  echo "Error: AirfoilHelper did not start in time." >&2
  exit 1
}

install_script "${TRACK_TITLES_COMPILED}"  "${TRACK_TITLES_SRC}"  "${TRACK_TITLES_DST}"  "TrackTitles"
install_script "${REMOTE_CTRL_COMPILED}"   "${REMOTE_CTRL_SRC}"   "${REMOTE_CTRL_DST}"   "RemoteControl"

echo ""
echo "Done. Reload Airfoil's source list (or restart Airfoil) to pick up the changes."
