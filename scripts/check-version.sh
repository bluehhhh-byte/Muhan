#!/usr/bin/env sh
set -eu

port="${WEB_PORT:-8080}"
base="http://127.0.0.1:${port}"
expected="${EXPECTED_VERSION:-0.7.0}"
marker="PC통신 UI v0.7.0"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for this check." >&2
  exit 2
fi

printf '\n== /version ==\n'
version_json="$(curl -fsS "${base}/version")"
printf '%s\n' "$version_json"
printf '%s' "$version_json" | grep -q "\"version\": \"${expected}\"" || {
  echo "\nERROR: gateway is not serving version ${expected}. You are probably still hitting an old container." >&2
  exit 1
}

printf '\n== HTML marker ==\n'
html="$(curl -fsS "${base}/")"
printf '%s' "$html" | grep -q "$marker" || {
  echo "\nERROR: HTML does not contain '${marker}'. Old container, wrong folder, or stale deployment." >&2
  exit 1
}

printf '%s' "$html" | grep -q 'ACCESS_TOKEN' && {
  echo "\nERROR: Served HTML still contains ACCESS_TOKEN. This is an old UI." >&2
  exit 1
}

echo "OK: ${base} is serving MUHAN PC통신 UI ${expected}."
