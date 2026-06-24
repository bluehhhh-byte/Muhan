#!/usr/bin/env sh
set -eu

: "${MUHAN_HOME:=/opt/muhan}"
: "${MUHAN_HOST:=127.0.0.1}"
: "${MUHAN_PORT:=4102}"
: "${WEB_HOST:=0.0.0.0}"
: "${WEB_PORT:=8080}"

if [ ! -x "$MUHAN_HOME/src/frp.new" ]; then
  echo "Missing executable: $MUHAN_HOME/src/frp.new" >&2
  exit 1
fi

mkdir -p /home
ln -sfn "$MUHAN_HOME" /home/muhan || true

echo "[entrypoint] starting MUHAN on ${MUHAN_HOST}:${MUHAN_PORT}"
MUHAN_HOME="$MUHAN_HOME" "$MUHAN_HOME/src/frp.new" -r "$MUHAN_PORT" >/tmp/muhan-frp.log 2>&1 &
muhan_pid=$!
web_pid=""

cleanup() {
  if [ -n "$web_pid" ]; then kill "$web_pid" >/dev/null 2>&1 || true; fi
  kill "$muhan_pid" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

if ! node /app/scripts/wait-for-tcp.js "$MUHAN_HOST" "$MUHAN_PORT" 20000; then
  echo "[entrypoint] MUHAN failed to start. Last log lines:" >&2
  tail -n 200 /tmp/muhan-frp.log >&2 || true
  exit 1
fi

echo "[entrypoint] starting web gateway on ${WEB_HOST}:${WEB_PORT}"
node /app/server/server.js &
web_pid=$!

while :; do
  if ! kill -0 "$muhan_pid" >/dev/null 2>&1; then
    echo "[entrypoint] MUHAN process exited. Last log lines:" >&2
    tail -n 200 /tmp/muhan-frp.log >&2 || true
    kill "$web_pid" >/dev/null 2>&1 || true
    wait "$web_pid" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$web_pid" >/dev/null 2>&1; then
    wait "$web_pid"
    exit $?
  fi

  sleep 2
done
