#!/usr/bin/env sh
set -eu

: "${MUHAN_REPO:=https://github.com/comfuture/muhan.git}"
: "${MUHAN_REF:=master}"

if [ -e vendor/muhan/src/Makefile ]; then
  echo "vendor/muhan already looks like a MUHAN checkout. Remove it first to refetch." >&2
  exit 0
fi

rm -rf vendor/muhan
mkdir -p vendor

echo "Fetching ${MUHAN_REPO}@${MUHAN_REF} into vendor/muhan"
git clone --depth 1 --branch "$MUHAN_REF" "$MUHAN_REPO" vendor/muhan 2>/dev/null || {
  rm -rf vendor/muhan
  git clone "$MUHAN_REPO" vendor/muhan
  cd vendor/muhan
  git checkout "$MUHAN_REF"
}
