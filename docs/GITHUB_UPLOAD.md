# GitHub Upload

이 저장소는 GitHub에 바로 올릴 수 있는 형태입니다.

## GitHub CLI 사용

```bash
./scripts/publish-github.sh muhan-web-runner public
```

위 스크립트는 다음을 수행합니다.

1. `.git`이 없으면 `git init`
2. 전체 파일 add/commit
3. 기본 브랜치 `main` 설정
4. `gh repo create ... --push` 또는 기존 `origin`으로 push

먼저 한 번은 GitHub 로그인이 필요합니다.

```bash
gh auth login
```

## 수동 업로드

```bash
git init
git add .
git commit -m "Add MUHAN PC communication web runner"
git branch -M main
git remote add origin git@github.com:YOUR_ID/muhan-web-runner.git
git push -u origin main
```

## 주의

- `.env`는 커밋하지 마세요. `.env.example`만 커밋하세요.
- Antigravity CLI 로그인 상태, OAuth 토큰, 개인 설정은 커밋하지 마세요.
- `vendor/muhan`에 실제 upstream 소스를 받아둔 경우, 라이선스와 출처를 확인한 뒤 커밋 여부를 결정하세요.
- 사용자 제공 스크린샷이나 실제 PC통신 서비스 로고/상표 이미지는 포함하지 않았습니다. 현재 UI는 오리지널 레트로 스타일 CSS입니다.
