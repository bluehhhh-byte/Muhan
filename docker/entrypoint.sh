#!/usr/bin/env sh
set -eu

: "${MUHAN_HOME:=/opt/muhan}"
: "${MUHAN_HOST:=127.0.0.1}"
: "${MUHAN_PORT:=4102}"
: "${WEB_HOST:=0.0.0.0}"
: "${WEB_PORT:=8080}"
: "${MUHAN_LOG:=/tmp/muhan-frp.log}"

if [ ! -d "$MUHAN_HOME" ]; then
  echo "Missing MUHAN_HOME directory: $MUHAN_HOME" >&2
  exit 1
fi

if [ ! -x "$MUHAN_HOME/src/frp.new" ]; then
  echo "Missing executable: $MUHAN_HOME/src/frp.new" >&2
  echo "Tip: the Docker build must finish make -C src ... successfully." >&2
  exit 1
fi

mkdir -p /home
ln -sfn "$MUHAN_HOME" /home/muhan || true
: > "$MUHAN_LOG"

echo "[entrypoint] MUHAN_HOME=$MUHAN_HOME"
echo "[entrypoint] starting MUHAN on ${MUHAN_HOST}:${MUHAN_PORT}"
(
  cd "$MUHAN_HOME"
  export MUHAN_HOME
  exec ./src/frp.new -r "$MUHAN_PORT"
) >"$MUHAN_LOG" 2>&1 &
muhan_pid=$!
web_pid=""

cleanup() {
  if [ -n "$web_pid" ]; then kill "$web_pid" >/dev/null 2>&1 || true; fi
  kill "$muhan_pid" >/dev/null 2>&1 || true
  # Future upstream builds may daemonize. Clean up a leftover frp.new that still
  # has this MUHAN_HOME in its command path, without treating failure as fatal.
  pkill -f "$MUHAN_HOME/src/frp.new" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

if ! node /app/scripts/wait-for-tcp.js "$MUHAN_HOST" "$MUHAN_PORT" 20000; then
  echo "[entrypoint] MUHAN failed to open TCP ${MUHAN_HOST}:${MUHAN_PORT}. Last log lines:" >&2
  tail -n 200 "$MUHAN_LOG" >&2 || true
  exit 1
fi

echo "[entrypoint] starting web gateway on ${WEB_HOST}:${WEB_PORT}"
node /app/server/server.js &
web_pid=$!

misses=0
while :; do
  if ! kill -0 "$web_pid" >/dev/null 2>&1; then
    wait "$web_pid"
    exit $?
  fi

  # Do not rely only on $muhan_pid. Upstream currently builds with -DDEBUG, but
  # legacy MUD builds often fork into the background. TCP readiness is the real
  # liveness signal for the web runner.
  if node /app/scripts/wait-for-tcp.js "$MUHAN_HOST" "$MUHAN_PORT" 1000 1000 >/dev/null 2>&1; then
    misses=0
  else
    misses=$((misses + 1))
    if [ "$misses" -ge 3 ]; then
      echo "[entrypoint] MUHAN TCP target is no longer reachable. Last log lines:" >&2
      tail -n 200 "$MUHAN_LOG" >&2 || true
      kill "$web_pid" >/dev/null 2>&1 || true
      wait "$web_pid" 2>/dev/null || true
      exit 1
    fi
  fi

  sleep 10
done
