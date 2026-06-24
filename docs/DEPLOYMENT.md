# Deployment

## Local Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Compose binds the web port to `127.0.0.1` by default through `BIND_HOST=127.0.0.1`.

## Antigravity CLI in Docker

The default `.env.example` enables the AI tab but does not install `agy` automatically.

```env
INSTALL_AGY=0
ENABLE_AGENT=1
AGENT_COMMAND=agy
AGENT_WORKDIR=/workspace
```

If the AI status says `command not found: agy`, install `agy` into the running container:

```bash
docker compose up --build -d
make agent-install
docker compose up -d
```

Alternatively, install `agy` during Docker build:

```env
INSTALL_AGY=1
ENABLE_AGENT=1
```

```bash
docker compose build --no-cache
docker compose up -d
```

If the installer is blocked by network policy, set `AGENT_COMMAND=sh` for a shell-based bridge test or keep using the game tab.

The Antigravity CLI first-run flow may require login and workspace trust confirmation.

## Public deployment

The app has no built-in token in v0.4. Keep `BIND_HOST=127.0.0.1`, use a VPN/SSH tunnel, or put the app behind an authenticated reverse proxy before changing `BIND_HOST=0.0.0.0`.
