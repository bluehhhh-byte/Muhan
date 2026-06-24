# Changelog

## 0.3.0

- Changed Docker runtime from `node:22-bookworm-slim` to `node:22-trixie-slim` and build image to explicit `gcc:14-trixie` to avoid glibc/runtime-library mismatches.
- Added optional `vendor/muhan` upstream source support for Docker environments that cannot reach GitHub during build.
- Added `scripts/fetch-upstream.sh` and `scripts/doctor.sh`.
- Changed `/healthz` to gateway-only by default; `/readyz` and `/api/status` include MUHAN TCP probing.
- Added browser diagnostics and an explicit Enter button.
- Added `MAX_CLIENTS`, `TCP_CONNECT_TIMEOUT_MS`, `MUHAN_LOG_TO_STDOUT`, and `MUHAN_START_TIMEOUT_MS` configuration.
- Improved close-frame handling and connection accounting in the WebSocket gateway.
- Stream MUHAN server logs to Docker logs by default.

## 0.2.0

- Fixed MUHAN startup to run from `MUHAN_HOME` instead of `/app`.
- Matched upstream smoke-test convention by creating `/home/muhan -> MUHAN_HOME`.
- Changed container supervision to check TCP liveness instead of relying only on the first `frp.new` PID.
- Added binary WebSocket output from gateway to browser for safer UTF-8 handling.
- Added a minimal telnet IAC filter, enabled by default with `TELNET_FILTER=1`.
- Added `npm test` gateway smoke test and CI step.

## 0.1.0

- Initial Docker + Node WebSocket gateway wrapper.
