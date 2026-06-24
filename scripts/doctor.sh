#!/usr/bin/env sh
set -eu

compose="docker compose"
if command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  compose="docker-compose"
fi

port="${WEB_PORT:-8080}"
expected="0.7.0"
marker="PC통신 UI v0.7.0"

printf '\n== Docker Compose project ==\n'
$compose config --format json 2>/dev/null | head -c 2600 || $compose config || true
printf '\n\n== Docker Compose status ==\n'
$compose ps || true

printf '\n== Containers publishing port %s ==\n' "$port"
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep ":$port->" || true

printf '\n== Known MUHAN containers ==\n'
docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -Ei 'muhan|runner|Muhan' || true

printf '\n== Recent logs ==\n'
$compose logs --tail=260 || true

if command -v curl >/dev/null 2>&1; then
  printf '\n== HTTP probes on localhost:%s ==\n' "$port"
  for path in /version /healthz /readyz /api/status; do
    printf '\n-- %s --\n' "$path"
    curl -sS "http://127.0.0.1:${port}${path}" || true
    printf '\n'
  done

  printf '\n== HTML marker ==\n'
  html="$(curl -fsS "http://127.0.0.1:${port}/" || true)"
  if printf '%s' "$html" | grep -q "$marker" && printf '%s' "$html" | grep -q "app-version.*${expected}"; then
    echo "OK: PC통신 UI marker found (${expected})."
  else
    echo "ERROR: PC통신 UI marker not found. You are still seeing an old container, old repo folder, or a process on port ${port}." >&2
    echo "Expected marker: ${marker}" >&2
    echo "First 500 chars served from /:" >&2
    printf '%s' "$html" | head -c 500 >&2 || true
    echo >&2
  fi
else
  echo "curl is not installed; open http://127.0.0.1:${port}/version in a browser. Expected version: ${expected}."
fi
