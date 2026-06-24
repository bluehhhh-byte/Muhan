# Architecture

```text
Browser
  └─ WebSocket /ws
      └─ Node.js gateway
          └─ TCP 127.0.0.1:4102
              └─ MUHAN frp.new
```

The browser never talks to the MUHAN TCP port directly. It connects to the Node gateway over WebSocket. The gateway opens a TCP connection to the legacy MUHAN server and relays bytes both ways.

## Why not rewrite MUHAN as a web app?

The C server already owns the game loop, player persistence, room/object data, combat, and command parser. This project keeps that logic intact and adds a transport adapter around it.

## Process model

The container starts two processes under `docker/entrypoint.sh`:

1. `MUHAN_HOME/src/frp.new -r MUHAN_PORT`
2. `node /app/server/server.js`

The entrypoint supervises the MUHAN TCP port and exits if the target becomes unreachable several times in a row.

## Health endpoints

- `/healthz`: gateway-only health by default. This is used by Docker healthcheck.
- `/readyz`: gateway + MUHAN TCP readiness.
- `/api/status`: same target readiness JSON used by the browser diagnostics panel.

`HEALTHCHECK_TARGET=1` makes `/healthz` also probe the MUHAN TCP target, but the default is `0` to avoid periodic healthcheck connections becoming visible to the MUD as short-lived clients.

## Telnet negotiation

The gateway includes a small telnet IAC filter. By default it rejects server telnet options with DONT/WONT and strips negotiation bytes from browser output. Set `TELNET_FILTER=0` to disable this behavior.
