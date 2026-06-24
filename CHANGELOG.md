# Changelog

## v0.5.0

- Reworked the home page into an old Korean PC communication service style UI.
- Added a gray desktop-client frame, menu bar, toolbar, left-side connection menu, blue VT terminal screen, boot splash, and bottom status bar.
- Avoided bundling third-party PC communication logos or screenshots; the retro look is implemented as original CSS.
- Removed the browser/game access token flow completely.
- Replaced the old token field with live status cards.
- Added tabbed UI: Game and AI Development.
- Added `/ws/mud` as the primary game WebSocket endpoint while keeping `/ws` as a legacy alias.
- Added `/ws/agent` WebSocket endpoint for an optional Antigravity CLI terminal.
- Added `server/pty_bridge.py` so TUI CLIs can run under a real pseudo-terminal.
- Added optional Docker build arg `INSTALL_AGY=1` for installing `agy` in the runtime image.
- Added a persistent Compose volume for Antigravity CLI config and local binaries.
- Added a `/workspace` bind mount so the AI console can edit this repository.
- Added `scripts/smoke-agent.js`.

## v0.3.0

- Aligned build/runtime Debian generation to Trixie.
- Added vendor fallback for MUHAN upstream source.
- Added `/healthz`, `/readyz`, and `/api/status` separation.
- Added status button and Enter button to the browser UI.
- Improved WebSocket close handling and connection limits.
