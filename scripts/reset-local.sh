#!/usr/bin/env sh
set -eu

compose="docker compose"
if command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  compose="docker-compose"
fi

port="${WEB_PORT:-8080}"

printf '\n== Stop current compose project ==\n'
$compose down --remove-orphans --volumes || true

printf '\n== Remove known MUHAN runner containers ==\n'
ids=""
for pattern in muhan-web-runner muhan_web muhan-web Muhan; do
  found="$(docker ps -aq --filter name="$pattern" 2>/dev/null || true)"
  if [ -n "$found" ]; then
    ids="$ids $found"
  fi
done
if [ -n "$(printf '%s' "$ids" | tr -d ' ')" ]; then
  # shellcheck disable=SC2086
  docker rm -f $ids || true
else
  echo "No known MUHAN runner containers found by name."
fi

printf '\n== Remove any Docker container publishing port %s ==\n' "$port"
port_ids="$(docker ps -q --filter publish="$port" 2>/dev/null || true)"
if [ -n "$port_ids" ]; then
  # shellcheck disable=SC2086
  docker rm -f $port_ids || true
else
  echo "No Docker container is publishing port $port."
fi

printf '\n== Remove known MUHAN runner images ==\n'
docker image rm \
  muhan-web-runner:local \
  muhan-web-runner-v07:local \
  muhan-web-runner-v06:local \
  muhan-web-runner-v05:local \
  muhan-web-runner-v04:local \
  2>/dev/null || true

printf '\n== Local process using port %s, if any ==\n' "$port"
if command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
else
  echo "lsof not installed. Docker port check was already done."
fi

cat <<MSG

Reset finished.
Now run:
  docker compose build --no-cache
  docker compose up --force-recreate --renew-anon-volumes

Then check:
  curl http://127.0.0.1:${port}/version
  curl http://127.0.0.1:${port}/ | grep "PC통신 UI v0.7.0"

Expected UI/version: 0.7.0
MSG
