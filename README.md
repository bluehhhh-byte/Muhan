# 무한대전 Web Runner

무한대전(MUHAN) 복구본을 Docker로 빌드하고, 브라우저에서 WebSocket으로 접속할 수 있게 만든 래퍼 프로젝트입니다. v0.5부터는 같은 웹 화면에 선택형 **AI 개발 콘솔**을 추가했습니다.

```text
Browser
  ├─ WebSocket /ws/mud
  │   └─ Node.js gateway
  │       └─ TCP 127.0.0.1:4102
  │           └─ MUHAN frp.new
  │
  └─ WebSocket /ws/agent
      └─ Node.js gateway
          └─ PTY bridge
              └─ agy 또는 AGENT_COMMAND
```

원본 MUHAN 서버 코드는 기본적으로 Docker 빌드 시점에 `comfuture/muhan`에서 가져오며, 이 저장소는 웹 게이트웨이와 실행/진단 스크립트만 제공합니다.

## v0.5 수정 사항

- `http://localhost:8080/` 첫 화면을 옛 PC통신 클라이언트풍 UI로 바꿨습니다.
  - 회색 윈도우 프레임
  - 메뉴/툴바/좌측 접속 메뉴
  - 파란 VT 화면
  - 청록색 대형 타이틀과 `아무키나 누르세요...` 부트 화면
  - 하단 상태바
- 실제 천리안/하이텔/나우누리 로고 이미지는 저장소에 포함하지 않았고, CSS로 만든 오리지널 레트로 스타일만 사용했습니다.
- 게임 접속용 `ACCESS_TOKEN`을 제거했습니다.
- 기존 접속 토큰 입력 위치를 **Gateway / MUD / AI 개발 / 접속 수 상태 카드**로 교체했습니다.
- WebSocket 경로를 분리했습니다.
  - `/ws/mud`: 게임 접속
  - `/ws/agent`: AI 개발 콘솔
  - `/ws`: v0.3 호환용 게임 접속 경로
- `ENABLE_AGENT=1`일 때 브라우저의 **AI 개발** 탭에서 `AGENT_COMMAND`를 실행할 수 있습니다.
- 기본 `AGENT_COMMAND`는 `agy`입니다.
- Docker 런타임에 `curl`, `git`, `python3`, `util-linux`를 포함했습니다.
- Python PTY bridge를 통해 TUI 계열 CLI가 브라우저 콘솔에서도 더 자연스럽게 동작하도록 했습니다.
- Antigravity CLI 인증/설정이 컨테이너 재생성 후에도 남도록 `agent-home:/root` 볼륨을 추가했습니다.
- 프로젝트 루트를 `/workspace`로 마운트합니다. AI 개발 콘솔은 기본적으로 `/workspace`에서 실행됩니다.

## GitHub 업로드

이 환경에서는 사용자의 GitHub 계정 권한이 연결되어 있지 않으므로, 자동 push는 로컬에서 실행하는 방식으로 제공됩니다.

```bash
./scripts/publish-github.sh muhan-web-runner public
```

또는 `docs/GITHUB_UPLOAD.md`의 수동 업로드 명령을 사용하세요.

레트로 디자인 세부 사항은 `docs/DESIGN.md`에 정리했습니다.

## 빠른 실행

```bash
cp .env.example .env
docker compose up --build
```

브라우저에서 접속합니다.

```text
http://localhost:8080
```

화면에서 **게임 접속** 버튼을 누르면 MUD 서버에 붙습니다. 첫 화면에서 `[엔터]를 누르세요.`가 보이면 키보드 Enter 또는 화면의 **엔터** 버튼을 누르세요.

## 접속 토큰

v0.5에서는 게임 접속 토큰이 없습니다.

```text
로컬/개인 플레이 기준: 바로 접속
외부 공개 서버 기준: reverse proxy, 방화벽, VPN, Basic Auth 등 앞단 보호 권장
```

게임 WebSocket 자체에는 인증을 넣지 않았습니다. 혼자 쓰는 환경에 맞춘 구성입니다.

## AI 개발 콘솔 켜기

`.env.example` 기준으로 AI 개발 탭은 켜져 있지만, `agy` 자동 설치는 꺼져 있습니다.

```env
ENABLE_AGENT=1
INSTALL_AGY=0
AGENT_COMMAND=agy
AGENT_WORKDIR=/workspace
```

이 상태에서 `agy`가 컨테이너 안에 없으면 AI 상태 카드에 `command not found: agy`가 표시됩니다.

### 방법 A: 실행 중인 컨테이너에 agy 설치

먼저 컨테이너를 실행합니다.

```bash
docker compose up --build -d
```

그 다음 컨테이너 안에 Antigravity CLI를 설치합니다.

```bash
make agent-install
```

위 명령은 컨테이너 안에서 다음 설치 명령을 실행합니다.

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

설치 파일과 로그인 설정은 `agent-home` Docker 볼륨의 `/root` 아래에 저장됩니다.

그 다음 `.env`에서 AI 개발 콘솔이 켜져 있는지 확인합니다.

```env
ENABLE_AGENT=1
AGENT_COMMAND=agy
AGENT_WORKDIR=/workspace
```

다시 시작합니다.

```bash
docker compose up -d
```

브라우저에서 **AI 개발** 탭을 열고 **AI 연결**을 누르세요. 첫 실행이면 Antigravity CLI가 로그인, 약관, 작업 폴더 신뢰 설정을 물어볼 수 있습니다.

### 방법 B: Docker build 중 agy 설치

빌드 시점에 설치하고 싶으면 `.env`에서 다음처럼 설정합니다.

```env
INSTALL_AGY=1
ENABLE_AGENT=1
```

그리고 다시 빌드합니다.

```bash
docker compose build --no-cache
docker compose up -d
```

단, 외부 설치 스크립트에 의존하므로 네트워크가 막힌 환경에서는 실패할 수 있습니다.

## AI 개발 콘솔을 쉘로 테스트하기

`agy` 설치 전 연결 테스트만 하고 싶으면 `.env`에서 다음처럼 바꿀 수 있습니다.

```env
ENABLE_AGENT=1
AGENT_COMMAND=sh
AGENT_WORKDIR=/workspace
```

그 뒤 브라우저의 **AI 개발** 탭에서 `pwd`, `ls`, `git status` 같은 명령을 확인할 수 있습니다.

## 안 될 때 바로 확인

```bash
make doctor
```

또는:

```bash
docker compose logs --tail=240 -f
```

상태 엔드포인트:

```text
http://localhost:8080/healthz     # 웹 게이트웨이 상태
http://localhost:8080/readyz      # MUHAN TCP 포함 준비 상태
http://localhost:8080/api/status  # 브라우저 UI가 쓰는 상태 JSON
```

자주 보는 실패 패턴은 다음과 같습니다.

| 증상 | 확인할 것 |
|---|---|
| `Could not resolve host: github.com` | Docker 빌드 환경에서 GitHub DNS/네트워크가 막혀 있습니다. 아래 “오프라인/방화벽 환경”을 사용하세요. |
| `version 'GLIBC_...' not found` | 오래된 이미지 캐시가 남았을 수 있습니다. `make clean` 후 새 ZIP으로 다시 빌드하세요. |
| `MUHAN failed to open TCP` | MUHAN C 서버가 부팅 중 죽었습니다. `docker compose logs --tail=240`에서 MUHAN 로그를 확인하세요. |
| 브라우저는 열리는데 게임 접속 후 실패 | `/api/status`의 `mud.ready`가 `true`인지 확인하세요. |
| AI 탭에서 연결 실패 | `/api/status`의 `agent.error`를 확인하세요. 보통 `ENABLE_AGENT=0` 또는 `command not found: agy`입니다. |
| AI 탭에서 로그인/신뢰 질문이 보임 | 정상입니다. Antigravity CLI 최초 실행 설정을 완료하세요. |
| 한글 깨짐 | 기본은 UTF-8입니다. 브라우저가 아니라 telnet/netcat으로도 같은지 비교하세요. |

## 오프라인/방화벽 환경: upstream 로컬 vendoring

Docker 빌드 중 GitHub 접근이 막히는 환경이면 호스트에서 먼저 upstream을 받아둔 뒤 빌드할 수 있습니다.

```bash
make fetch-upstream
# 또는 직접:
# rm -rf vendor/muhan
# git clone --depth 1 https://github.com/comfuture/muhan.git vendor/muhan

docker compose up --build
```

`vendor/muhan/src/Makefile`이 있으면 Dockerfile은 네트워크 clone 대신 그 로컬 소스를 사용합니다.

주의: MUHAN 원본/복구본의 권리 조건은 이 래퍼 프로젝트와 별도입니다. 공개 GitHub 저장소에 `vendor/muhan`까지 같이 올릴지 여부는 upstream의 권리 조건을 확인한 뒤 결정하세요.

## 공개 서버로 열 때

v0.5에서는 게임 토큰을 제거했습니다. Compose 기본값은 `127.0.0.1` 바인딩이라 로컬 PC에서만 열립니다. `BIND_HOST=0.0.0.0` 등으로 공개 서버에 올리면 누구나 게임 WebSocket에 접근할 수 있습니다.

공개 인터넷에 노출할 경우 최소한 아래 중 하나를 적용하세요.

```text
- 공유기/방화벽에서 본인 IP만 허용
- Tailscale / WireGuard / ZeroTier 같은 사설망 안에서만 노출
- Nginx / Caddy / Traefik 앞단에 Basic Auth 적용
- Cloudflare Access 같은 접근 제어 적용
```

AI 개발 콘솔은 파일 수정과 명령 실행이 가능한 도구와 연결될 수 있으므로 공개 서버에서는 꺼두는 것을 권장합니다.

```env
ENABLE_AGENT=0
```

## upstream 소스 고정

기본값은 `comfuture/muhan`의 `master` 브랜치입니다.

```env
MUHAN_REPO=https://github.com/comfuture/muhan.git
MUHAN_REF=master
```

운영 배포라면 `MUHAN_REF`를 브랜치명이 아니라 특정 커밋 SHA로 고정하는 것을 권장합니다.

## GitHub에 올리기

```bash
git init
git add .
git commit -m "Add MUHAN web runner"
git branch -M main

gh repo create YOUR_ID/muhan-web-runner --public --source=. --remote=origin --push
```

GitHub CLI를 쓰지 않는 경우 GitHub에서 빈 저장소를 만든 뒤 아래처럼 푸시합니다.

```bash
git remote add origin git@github.com:YOUR_ID/muhan-web-runner.git
git push -u origin main
```

## 로컬 upstream 체크아웃으로 개발하기

이미 `comfuture/muhan`을 로컬에 받아 빌드했다면 Docker 없이 게이트웨이만 실행할 수 있습니다.

```bash
# upstream 쪽에서 먼저 빌드
make -C /path/to/muhan/src -j1 CC=cc

# 이 프로젝트 루트에서 실행
MUHAN_HOME=/path/to/muhan ./scripts/run-local.sh
```

## 주요 명령

```bash
make check          # Node/Python 문법 검사
make test           # MUD 게이트웨이 + AI 콘솔 스모크 테스트
make fetch-upstream # vendor/muhan에 upstream 복구본 받기
make build          # Docker 이미지 빌드
make run            # 빌드 후 실행
make logs           # 로그 보기
make doctor         # 컨테이너 상태 + 최근 로그 + HTTP 상태
make agent-install  # 실행 중인 컨테이너 안에 agy 설치
make agent-shell    # 실행 중인 컨테이너 쉘 열기
make down           # 중지
make clean          # compose 중지 + 로컬 이미지 삭제
```

## 운영 메모

- Docker Compose는 기본적으로 `127.0.0.1:8080`에만 웹 UI를 엽니다. MUHAN TCP 포트 `4102`는 컨테이너 내부에서만 사용합니다.
- GitHub Pages만으로는 실행할 수 없습니다. MUD 서버와 WebSocket 프록시가 필요하므로 Docker를 실행할 수 있는 VPS, NAS, 홈서버, 컨테이너 호스팅이 필요합니다.
- 이 래퍼 프로젝트 코드는 MIT로 제공하지만, MUHAN 원본/복구본의 권리 조건은 별도로 확인해야 합니다.
