# Architecture

```text
Browser
  ├─ /ws/mud
  │   └─ Node.js WebSocket server
  │       └─ TCP bridge
  │           └─ MUHAN frp.new on 127.0.0.1:4102
  │
  └─ /ws/agent
      └─ Node.js WebSocket server
          └─ Python PTY bridge
              └─ AGENT_COMMAND, default: agy
```

`/ws` is kept as a legacy alias for the game connection.

## Game path

The browser connects to `/ws/mud`. The Node gateway upgrades the HTTP connection to WebSocket, opens a TCP connection to the local MUHAN server, and forwards bytes in both directions.

A small Telnet negotiation filter strips or answers common Telnet control bytes so the browser sees mostly readable terminal text.

## Agent path

The browser connects to `/ws/agent`. The Node gateway starts `server/pty_bridge.py`, and the Python bridge creates a real pseudo-terminal before launching `AGENT_COMMAND`.

This matters because Antigravity CLI is a terminal TUI. A plain pipe is often not enough for interactive login prompts, menu prompts, and screen rendering.

## Authentication

v0.4 intentionally has no built-in access token. It is intended for local, single-user play.

For public deployments, put authentication in front of this app with a reverse proxy, VPN, SSH tunnel, or IP allowlist.
