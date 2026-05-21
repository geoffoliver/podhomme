# Airfoil Integration Scripts

These AppleScript files tell Airfoil how to read track metadata from Podhomme
and how to send playback commands back to it.

## Installation

The scripts must be compiled against the running helper app (so the AppleScript
runtime can resolve the property codes from its scripting definition). **Start
Podhomme first**, then run:

```bash
# TrackTitles — lets Airfoil display episode/podcast info in its UI
osacompile -o ~/Library/Application\ Support/Airfoil/TrackTitles/com.podhomme.airfoil-helper.scpt \
  TrackTitles/com.podhomme.airfoil-helper.applescript

# RemoteControl — lets Airfoil's remote (AirfoilSatellite, iOS app, etc.) control playback
osacompile -o ~/Library/Application\ Support/Airfoil/RemoteControl/dacp.com.podhomme.airfoil-helper.scpt \
  RemoteControl/dacp.com.podhomme.airfoil-helper.applescript
```

Then in Airfoil, select **Podhomme** as the audio source and it will
automatically pick up the Now Playing metadata and respond to remote controls.

## What each script does

| Script | Purpose |
|--------|---------|
| `TrackTitles/com.podhomme.airfoil-helper.applescript` | Airfoil calls this to get the current episode title, podcast name, duration, and artwork |
| `RemoteControl/dacp.com.podhomme.airfoil-helper.applescript` | Airfoil calls these handlers when a remote control action is triggered (play, pause, next, previous) |
