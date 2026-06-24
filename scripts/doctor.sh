#!/usr/bin/env sh
set -eu

compose="docker compose"
if command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  compose="docker-compose"
fi

printf '\n== Docker Compose status ==\n'
$compose ps || true

printf '\n== Recent logs ==\n'
$compose logs --tail=220 || true

port="${WEB_PORT:-8080}"
printf '\n== HTTP probes on localhost:%s ==\n' "$port"
for path in /healthz /readyz /api/status; do
  printf '\n-- %s --\n' "$path"
  if command -v curl >/dev/null 2>&1; then
    curl -sS "http://127.0.0.1:${port}${path}" || true
    printf '\n'
  else
    echo "curl is not installed; open http://127.0.0.1:${port}${path} in a browser."
  fi
done
