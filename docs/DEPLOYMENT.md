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

## VPS / NAS / home server

1. Install Docker and Docker Compose.
2. Clone your GitHub repository.
3. Copy `.env.example` to `.env`.
4. Set a long random `ACCESS_TOKEN`.
5. Run `docker compose up -d --build`.
6. Put Nginx/Caddy/Traefik in front if exposing it on the public internet.

## Reverse proxy note

The proxy must support WebSocket upgrade headers. With Nginx, the essential pieces are:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
```

## Offline build / restricted Docker network

If Docker cannot access GitHub during build:

```bash
make fetch-upstream
docker compose up --build
```

The Dockerfile uses `vendor/muhan` when it contains `src/Makefile`.
