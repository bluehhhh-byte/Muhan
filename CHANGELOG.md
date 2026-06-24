# Changelog

## 0.7.0

- Replace the old dark UI with a PC communication service style screen.
- Remove all user-facing access token UI.
- Add visible `PC통신 UI v0.7.0` markers to make stale deployments obvious.
- Fix Compose naming to `muhan-web-runner` and container name to `muhan-web-runner`.
- Add bind mounts for `web`, `server`, and `scripts` to reduce Docker image cache confusion during local development.
- Strengthen reset and doctor scripts for stale containers on port 8080.
