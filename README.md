# 무한대전 PC통신 Web Runner

MUHAN legacy MUD server를 브라우저에서 플레이할 수 있게 하는 로컬 WebSocket/TCP 게이트웨이입니다.

## v0.7 핵심

- 첫 화면을 옛날 PC통신 클라이언트풍으로 변경했습니다.
- `ACCESS_TOKEN` 입력창을 완전히 제거했습니다.
- 토큰이 있던 자리는 Gateway / MUD / Antigravity / Sessions 상태 카드로 바꿨습니다.
- 정적 파일 캐시를 끄고 `/version`, `/api/version`, `scripts/check-version.sh`로 현재 실행 중인 버전을 확인할 수 있게 했습니다.
- Docker Compose 프로젝트명과 컨테이너명을 `muhan-web-runner`로 고정했습니다.
- `./web`, `./server`, `./scripts`를 컨테이너에 bind mount해 이미지 캐시가 남아 있어도 재기동 후 현재 파일이 반영되게 했습니다.

> 참고 이미지의 실제 천리안/하이텔/나우누리 로고와 상표 이미지는 포함하지 않았습니다. 공개 저장소에 올릴 수 있도록 HTML/CSS로 만든 오리지널 PC통신풍 UI입니다.

## 실행

```bash
cp .env.example .env
make fresh
```

브라우저에서 엽니다.

```text
http://localhost:8080/
```

정상 반영 확인:

```bash
curl http://127.0.0.1:8080/version
curl http://127.0.0.1:8080/ | grep "PC통신 UI v0.7.0"
```

화면에 `PC통신 UI v0.7.0` 또는 `UI v0.7.0`이 보여야 합니다.

## 이전 화면이 계속 뜰 때

예전 화면에 `ACCESS_TOKEN` 입력창이 보이면 아직 이전 컨테이너가 `localhost:8080`을 잡고 있는 것입니다.

```bash
make reset
make fresh
```

그래도 동일하면 누가 8080을 쓰는지 확인합니다.

```bash
make doctor
```

수동으로 Docker 컨테이너를 정리하려면:

```bash
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}'
docker rm -f $(docker ps -q --filter publish=8080)
docker compose build --no-cache
docker compose up --force-recreate --renew-anon-volumes
```

브라우저도 강력 새로고침하세요.

- Windows/Linux: `Ctrl + F5`
- macOS: `Cmd + Shift + R`

## Antigravity CLI

AI 개발 콘솔은 `/ws/agent`로 분리되어 있습니다.

```env
ENABLE_AGENT=1
AGENT_COMMAND=agy
AGENT_WORKDIR=/workspace
```

컨테이너 안에 `agy`가 없으면 상태 카드에 `command not found: agy`가 표시됩니다.

## GitHub 업로드

```bash
git add -A
git commit -m "Apply PC communication style UI"
git push
```

새 저장소로 올리려면:

```bash
./scripts/publish-github.sh muhan-web-runner public
```

GitHub Pages는 정적 파일 호스팅이므로 이 Node.js/WebSocket/MUD 서버 프로젝트를 그대로 실행할 수 없습니다. 로컬 Docker, VPS, Codespaces, Render/Fly/Railway 같은 컨테이너 실행 환경이 필요합니다.
