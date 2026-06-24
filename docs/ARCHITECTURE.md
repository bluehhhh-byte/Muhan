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

The legacy server speaks TCP. Browsers cannot open raw TCP sockets, so the web client talks WebSocket and the Node gateway forwards byte streams to the local MUD process.

## Process model

The Docker entrypoint starts MUHAN from the repository root, matching the upstream smoke-test style:

```sh
cd "$MUHAN_HOME"
export MUHAN_HOME
./src/frp.new -r "$MUHAN_PORT"
```

It also creates `/home/muhan -> $MUHAN_HOME` because legacy paths and restored scripts can still assume that location.

The entrypoint then starts `node /app/server/server.js`. Liveness is checked by probing the MUHAN TCP port, not only by the first process PID, because old MUD builds may daemonize/fork depending on compile flags.

## Encoding and telnet handling

The gateway forwards browser text frames to MUHAN as UTF-8 bytes. MUHAN output is sent back to the browser as binary WebSocket frames, so multi-byte Korean text is not prematurely decoded in Node.

`TELNET_FILTER=1` is enabled by default. It removes basic telnet IAC negotiation bytes from visible browser output and replies conservatively with `DONT/WONT` where needed. Set `TELNET_FILTER=0` to pass raw bytes through while debugging.

The browser UI strips common ANSI control sequences by default, but the toggle can be disabled.

## Authentication

This is intentionally minimal. If `ACCESS_TOKEN` is set, WebSocket upgrades must include the same token via the `token` query parameter or an `Authorization: Bearer` header. Static HTML is still public, but game sessions are blocked.

For real public hosting, put the service behind HTTPS and a reverse proxy.
