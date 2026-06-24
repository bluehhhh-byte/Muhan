# Security Notes

This project is a thin web gateway around a legacy game server. Treat it as a
public network service.

## Defaults

- The raw MUHAN TCP port is not published by Docker Compose.
- Only the web gateway port is exposed.
- `ACCESS_TOKEN` can gate WebSocket sessions.
- Idle sessions close after `IDLE_TIMEOUT_MS`.
- Browser-originated WebSocket frames are limited by `MAX_FRAME_SIZE`.

## Before public hosting

1. Set `ACCESS_TOKEN`.
2. Use HTTPS through a reverse proxy.
3. Keep the service inside a container.
4. Back up `player/`, `post/`, and any persistent game data if you later mount volumes.
5. Consider adding rate limiting at the reverse proxy.

## Not implemented

- Account system outside the MUD itself
- Admin dashboard
- TLS termination inside the Node process
- Persistent volume layout for production character data

Those can be added later without changing the core gateway design.
