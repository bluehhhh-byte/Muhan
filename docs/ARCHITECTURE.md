# Architecture

## Goal

Run the restored MUHAN legacy MUD server as-is, then expose it through a browser.

## Runtime topology

```text
+------------------+       WebSocket        +---------------------+
| Browser terminal |  <------------------>  | Node.js web gateway |
+------------------+                        +----------+----------+
                                                       |
                                                       | TCP
                                                       v
                                            +----------------------+
                                            | MUHAN src/frp.new    |
                                            | 127.0.0.1:4102       |
                                            +----------------------+
```

## Why a WebSocket gateway?

The legacy server speaks TCP. Browsers cannot open raw TCP sockets, so the web
client talks WebSocket and the Node gateway forwards byte streams to the local
MUD process.

## Process model

The Docker entrypoint starts two processes:

1. `MUHAN_HOME=/opt/muhan /opt/muhan/src/frp.new -r 4102`
2. `node /app/server/server.js`

The shell entrypoint monitors both. If the MUHAN process exits, the container
exits as unhealthy instead of leaving a dead web shell online.

## Encoding

The gateway forwards browser text frames as UTF-8 bytes. The browser UI strips
common ANSI control sequences by default, but the toggle can be disabled.

## Authentication

This is intentionally minimal. If `ACCESS_TOKEN` is set, WebSocket upgrades must
include the same token via the `token` query parameter or an `Authorization:
Bearer` header. Static HTML is still public, but game sessions are blocked.

For real public hosting, put the service behind HTTPS and a reverse proxy.
