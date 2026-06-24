# Deployment

## Local Docker

```bash
cp .env.example .env
docker compose up --build
```

Open:

```text
http://localhost:8080
```

## VPS deployment

1. Install Docker and Docker Compose.
2. Clone this repository.
3. Set `.env`.
4. Run `docker compose up -d --build`.
5. Put Nginx, Caddy, or another reverse proxy in front of port `8080`.
6. Enable HTTPS before allowing public users to log in.

Example `.env`:

```env
MUHAN_REPO=https://github.com/comfuture/muhan.git
MUHAN_REF=master
WEB_PORT=8080
MUHAN_PORT=4102
ACCESS_TOKEN=replace-with-a-long-random-token
IDLE_TIMEOUT_MS=1800000
TELNET_FILTER=1
```

## Reverse proxy note

The proxy must pass WebSocket upgrades for `/ws`.

For Nginx, the important headers are:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
```

## GitHub Pages is not enough

GitHub Pages can host static HTML only. This project requires a long-running MUD
server process and a WebSocket-to-TCP gateway, so use a server or container host.
