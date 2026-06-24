# Changelog

## 0.2.0

- Fixed MUHAN startup to run from `MUHAN_HOME` instead of `/app`.
- Matched upstream smoke-test convention by creating `/home/muhan -> MUHAN_HOME`.
- Changed container supervision to check TCP liveness instead of relying only on the first `frp.new` PID.
- Added binary WebSocket output from gateway to browser for safer UTF-8 handling.
- Added a minimal telnet IAC filter, enabled by default with `TELNET_FILTER=1`.
- Added `npm test` gateway smoke test and CI step.

## 0.1.0

- Initial Docker + Node WebSocket gateway wrapper.
