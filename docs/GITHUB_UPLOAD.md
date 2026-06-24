# GitHub Upload

이 저장소는 GitHub에 바로 올릴 수 있는 형태입니다. 단, GitHub에 push하는 것은 **코드 업로드**입니다. MUHAN C 서버와 Node WebSocket 게이트웨이를 실제로 실행하려면 Docker/Node를 실행할 수 있는 환경이 별도로 필요합니다.

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

## GitHub Pages로는 왜 안 되나

GitHub Pages는 정적 파일 호스팅에 적합합니다. 이 프로젝트는 다음 프로세스가 필요합니다.

```text
Node.js gateway + WebSocket + MUHAN frp.new C server
```

그래서 GitHub Pages에 올리면 HTML/CSS는 보일 수 있어도 `/ws/mud`, `/api/status`, MUHAN TCP 서버가 실행되지 않습니다.

GitHub 기반으로 실행하려면 다음 중 하나를 쓰세요.

- GitHub Codespaces에서 `docker compose up --build`
- VPS에서 `git clone` 후 `docker compose up --build -d`
- Render/Fly.io/Railway 같은 컨테이너 실행 환경

## 반영 확인

배포/실행 후 아래가 `0.7.0`이어야 합니다.

```text
http://localhost:8080/version
```

로컬에서는:

```bash
make version-check
```

## 주의

- `.env`는 커밋하지 마세요. `.env.example`만 커밋하세요.
- Antigravity CLI 로그인 상태, OAuth 토큰, 개인 설정은 커밋하지 마세요.
- `vendor/muhan`에 실제 upstream 소스를 받아둔 경우, 라이선스와 출처를 확인한 뒤 커밋 여부를 결정하세요.
- 사용자 제공 스크린샷이나 실제 PC통신 서비스 로고/상표 이미지는 포함하지 않았습니다. 현재 UI는 오리지널 레트로 스타일 CSS입니다.
