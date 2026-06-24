# 무한대전 Web Runner

무한대전(MUHAN) 복구본을 Docker로 빌드하고, 브라우저에서 WebSocket으로 접속할 수 있게 만든 래퍼 프로젝트입니다.

```text
Browser
  └─ WebSocket /ws
      └─ Node.js gateway
          └─ TCP 127.0.0.1:4102
              └─ MUHAN frp.new
```

원본 MUHAN 서버 코드는 기본적으로 Docker 빌드 시점에 `comfuture/muhan`에서 가져오며, 이 저장소는 웹 게이트웨이와 실행/진단 스크립트만 제공합니다.

## v0.3 수정 사항

v0.2에서 계속 실패할 수 있던 지점을 더 줄였습니다.

- `gcc:14` 빌드 이미지와 Node 런타임 이미지를 모두 Debian Trixie 계열로 맞췄습니다.
  - 이전 구조: `gcc:14` 빌드 → `node:22-bookworm-slim` 실행
  - 수정 구조: `gcc:14-trixie` 빌드 → `node:22-trixie-slim` 실행
  - 목적: glibc / system library 버전 불일치 방지
- Docker 빌드 환경에서 GitHub 접근이 막힐 때를 대비해 `vendor/muhan` 로컬 소스 빌드를 지원합니다.
- Docker 로그에 MUHAN 서버 로그가 바로 나오도록 `MUHAN_LOG_TO_STDOUT=1`을 기본값으로 추가했습니다.
- `/healthz`는 웹 게이트웨이만 확인하고, `/readyz`와 `/api/status`에서 MUHAN TCP 상태를 확인하도록 분리했습니다.
  - Docker healthcheck가 MUD 포트에 계속 접속해 유령 접속을 만드는 문제를 줄입니다.
- 브라우저 UI에 “상태 점검”과 “엔터” 버튼을 추가했습니다.
- WebSocket 게이트웨이에 `MAX_CLIENTS`, target connect timeout, close-frame 처리 개선을 추가했습니다.
- `make doctor`가 로그와 HTTP 상태를 한 번에 보여주도록 바꿨습니다.

## 빠른 실행

```bash
cp .env.example .env
docker compose up --build
```

브라우저에서 접속합니다.

```text
http://localhost:8080
```

화면에서 **접속** 버튼을 누르면 MUD 서버에 붙습니다. 첫 화면에서 `[엔터]를 누르세요.`가 보이면 키보드 Enter 또는 화면의 **엔터** 버튼을 누르세요.

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
| 브라우저는 열리는데 접속 버튼 후 실패 | `/api/status`가 `targetReady: true`인지 확인하세요. |
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

`.env`에서 토큰을 설정하세요.

```env
ACCESS_TOKEN=change-this-long-random-token
```

토큰을 설정하면 브라우저 화면의 “접속 토큰” 칸에 같은 값을 입력해야 WebSocket 접속이 됩니다.

외부 공개 시에는 reverse proxy에서 HTTPS/WSS를 적용하고, `MAX_CLIENTS` 값을 보수적으로 잡는 것을 권장합니다.

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
make check          # Node 문법 검사
make test           # WebSocket ↔ TCP 게이트웨이 스모크 테스트
make fetch-upstream # vendor/muhan에 upstream 복구본 받기
make build          # Docker 이미지 빌드
make run            # 빌드 후 실행
make logs           # 로그 보기
make doctor         # 컨테이너 상태 + 최근 로그 + HTTP 상태
make down           # 중지
make clean          # compose 중지 + 로컬 이미지 삭제
```

## 운영 메모

- Docker Compose는 외부에 `8080`만 노출합니다. MUHAN TCP 포트 `4102`는 컨테이너 내부에서만 사용합니다.
- GitHub Pages만으로는 실행할 수 없습니다. MUD 서버와 WebSocket 프록시가 필요하므로 Docker를 실행할 수 있는 VPS, NAS, 홈서버, 컨테이너 호스팅이 필요합니다.
- 이 래퍼 프로젝트 코드는 MIT로 제공하지만, MUHAN 원본/복구본의 권리 조건은 별도로 확인해야 합니다.
