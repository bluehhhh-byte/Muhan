#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-muhan-web-runner}"
VISIBILITY="${2:-public}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  cat >&2 <<MSG
GitHub CLI(gh)가 필요합니다.
설치 후 'gh auth login'을 먼저 실행하세요.
대체 수동 업로드:
  git init
  git add .
  git commit -m "Add MUHAN web runner"
  git branch -M main
  git remote add origin git@github.com:YOUR_ID/${REPO_NAME}.git
  git push -u origin main
MSG
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub 로그인이 필요합니다: gh auth login" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  git init
fi

git add .
if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "Add MUHAN PC communication web runner"
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin main
else
  gh repo create "${REPO_NAME}" "--${VISIBILITY}" --source=. --remote=origin --push
fi
