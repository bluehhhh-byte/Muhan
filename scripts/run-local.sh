#!/usr/bin/env sh
set -eu

: "${MUHAN_HOME:?Set MUHAN_HOME to a local comfuture/muhan checkout}"
: "${MUHAN_PORT:=4102}"
: "${MUHAN_HOST:=127.0.0.1}"
: "${WEB_HOST:=0.0.0.0}"
: "${WEB_PORT:=8080}"

if [ ! -x "$MUHAN_HOME/src/frp.new" ]; then
  echo "Missing executable: $MUHAN_HOME/src/frp.new" >&2
  echo "Build upstream first, for example: make -C \"$MUHAN_HOME/src\" -j1 CC=cc" >&2
  exit 1
fi

mkdir -p /home 2>/dev/null || true
ln -sfn "$MUHAN_HOME" /home/muhan 2>/dev/null || true

MUHAN_HOME="$MUHAN_HOME" "$MUHAN_HOME/src/frp.new" -r "$MUHAN_PORT" >/tmp/muhan-frp.log 2>&1 &
muhan_pid=$!
web_pid=""

cleanup() {
  if [ -n "$web_pid" ]; then kill "$web_pid" >/dev/null 2>&1 || true; fi
  kill "$muhan_pid" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

node ./scripts/wait-for-tcp.js "$MUHAN_HOST" "$MUHAN_PORT" 20000
node ./server/server.js &
web_pid=$!

wait "$web_pid"
