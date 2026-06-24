#!/usr/bin/env sh
set -eu

: "${MUHAN_HOME:=/opt/muhan}"
: "${MUHAN_HOST:=127.0.0.1}"
: "${MUHAN_PORT:=4102}"
: "${WEB_HOST:=0.0.0.0}"
: "${WEB_PORT:=8080}"
: "${MUHAN_LOG:=/tmp/muhan-frp.log}"
: "${MUHAN_LOG_TO_STDOUT:=1}"
: "${MUHAN_START_TIMEOUT_MS:=40000}"

case "$MUHAN_PORT" in
  ''|*[!0-9]*) echo "Invalid MUHAN_PORT: $MUHAN_PORT" >&2; exit 2 ;;
esac
case "$WEB_PORT" in
  ''|*[!0-9]*) echo "Invalid WEB_PORT: $WEB_PORT" >&2; exit 2 ;;
esac

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

# Avoid core dumps from a legacy C server inside small containers.
ulimit -c 0 2>/dev/null || true

muhan_pid=""
web_pid=""
tail_pid=""

stop_pid() {
  pid="$1"
  [ -n "$pid" ] || return 0
  kill "$pid" >/dev/null 2>&1 || true
  sleep 1
  kill -KILL "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  stop_pid "$web_pid"
  stop_pid "$muhan_pid"
  stop_pid "$tail_pid"
  # The legacy server ignores SIGTERM in some code paths. procps is installed in
  # the runtime image, but keep this non-fatal for local/non-Docker runs.
  pkill -KILL -f "$MUHAN_HOME/src/frp.new" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

if [ "$MUHAN_LOG_TO_STDOUT" != "0" ]; then
  tail -n +1 -F "$MUHAN_LOG" >&2 &
  tail_pid=$!
fi

echo "[entrypoint] MUHAN_HOME=$MUHAN_HOME"
echo "[entrypoint] MUHAN binary=$MUHAN_HOME/src/frp.new"
echo "[entrypoint] starting MUHAN on ${MUHAN_HOST}:${MUHAN_PORT}"
(
  cd "$MUHAN_HOME"
  export MUHAN_HOME
  exec ./src/frp.new -r "$MUHAN_PORT"
) >"$MUHAN_LOG" 2>&1 &
muhan_pid=$!

if ! node /app/scripts/wait-for-tcp.js "$MUHAN_HOST" "$MUHAN_PORT" "$MUHAN_START_TIMEOUT_MS"; then
  echo "[entrypoint] MUHAN failed to open TCP ${MUHAN_HOST}:${MUHAN_PORT}. Last log lines:" >&2
  tail -n 240 "$MUHAN_LOG" >&2 || true
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

  # Do not rely only on $muhan_pid. Legacy MUD builds can daemonize/fork or
  # ignore signals. TCP reachability is the real liveness signal for this web
  # runner.
  if node /app/scripts/wait-for-tcp.js "$MUHAN_HOST" "$MUHAN_PORT" 1200 1200 >/dev/null 2>&1; then
    misses=0
  else
    misses=$((misses + 1))
    if [ "$misses" -ge 3 ]; then
      echo "[entrypoint] MUHAN TCP target is no longer reachable. Last log lines:" >&2
      tail -n 240 "$MUHAN_LOG" >&2 || true
      stop_pid "$web_pid"
      wait "$web_pid" 2>/dev/null || true
      exit 1
    fi
  fi

  sleep 10
done
