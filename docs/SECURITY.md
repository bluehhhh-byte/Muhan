# Security notes

This project exposes an old MUD server through a browser-friendly WebSocket gateway. Treat it as an internet-facing legacy service.

## Minimum public-hosting checklist

- Set `ACCESS_TOKEN` in `.env`.
- Put the service behind HTTPS/WSS.
- Keep `MAX_CLIENTS` conservative.
- Do not expose the raw MUHAN TCP port to the internet unless you intend to support telnet clients directly.
- Keep server logs private; player names and commands may appear in logs depending on upstream settings.
- Pin `MUHAN_REF` to a reviewed commit for production.

## Authentication model

The built-in token check is a simple gate, not an account system. It is enough for a private friends-only server behind HTTPS, but not a full public authentication layer.

## WebSocket gateway limits

- Client frames must be masked.
- Oversized frames are rejected.
- Idle clients are disconnected after `IDLE_TIMEOUT_MS`.
- `MAX_CLIENTS` limits concurrent WebSocket sessions.
