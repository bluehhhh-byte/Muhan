# 무한대전 Web Runner

무한대전(MUHAN) 복구본을 Docker로 빌드하고, 브라우저에서 WebSocket으로 접속할 수 있게 만든 래퍼 프로젝트입니다.

```text
Browser
  └─ WebSocket /ws
      └─ Node.js gateway
          └─ TCP 127.0.0.1:4102
              └─ MUHAN frp.new
```

원본 MUHAN 서버 코드는 Docker 빌드 시점에 `comfuture/muhan`에서 가져오며, 이 프로젝트는 웹 게이트웨이와 실행 스크립트만 제공합니다.

## v0.2 수정 사항

이전 ZIP에서 작동하지 않을 수 있던 부분을 수정했습니다.

- MUHAN 실행 전 작업 디렉터리를 반드시 `MUHAN_HOME`으로 변경합니다.
- upstream 스모크 테스트와 같은 방식으로 `/home/muhan -> MUHAN_HOME` 심볼릭 링크를 만듭니다.
- MUD 프로세스 PID만 보지 않고 실제 TCP 포트 생존 여부로 감시합니다.
- WebSocket 게이트웨이가 MUD 출력을 binary frame으로 전달해 UTF-8 한글이 chunk 경계에서 깨질 가능성을 줄였습니다.
- 기본 telnet IAC 필터를 추가했습니다. 필요하면 `TELNET_FILTER=0`으로 끌 수 있습니다.
- `npm test` 게이트웨이 스모크 테스트를 추가했습니다.

## 빠른 실행

```bash
cp .env.example .env
docker compose up --build
```

브라우저에서 접속합니다.

```text
http://localhost:8080
```

화면에서 **접속** 버튼을 누르면 MUD 서버에 붙습니다.

## 로그 확인

작동하지 않으면 가장 먼저 아래 로그를 확인하세요.

```bash
docker compose logs --tail=200 -f
```

자주 보는 실패 패턴은 다음과 같습니다.

| 증상 | 확인할 것 |
|---|---|
| `Could not resolve host: github.com` | Docker 빌드 환경에서 GitHub 접근/DNS가 막혀 있습니다. |
| `MUHAN failed to open TCP` | MUHAN 서버가 부팅 중 죽었습니다. 로그 tail에 C 서버 에러가 나옵니다. |
| 브라우저는 열리는데 접속 버튼 후 실패 | `/healthz`가 200인지, `MUHAN_PORT`가 겹치지 않는지 확인합니다. |
| 한글 깨짐 | upstream 복구본은 UTF-8 운영 정책입니다. 브라우저/프록시를 거치지 않고 telnet으로도 같은지 비교하세요. |

간단 점검:

```bash
make doctor
```

## 공개 서버로 열 때

`.env`에서 토큰을 설정하세요.

```env
ACCESS_TOKEN=change-this-long-random-token
```

토큰을 설정하면 브라우저 화면의 “접속 토큰” 칸에 같은 값을 입력해야 WebSocket 접속이 됩니다.

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
make check      # Node 문법 검사
make test       # WebSocket ↔ TCP 게이트웨이 스모크 테스트
make build      # Docker 이미지 빌드
make run        # 빌드 후 실행
make logs       # 로그 보기
make doctor     # 컨테이너 상태 + 최근 로그
make down       # 중지
```

## 운영 메모

- Docker Compose는 외부에 `8080`만 노출합니다. MUHAN TCP 포트 `4102`는 컨테이너 내부에서만 사용합니다.
- GitHub Pages만으로는 실행할 수 없습니다. MUD 서버와 WebSocket 프록시가 필요하므로 Docker를 실행할 수 있는 VPS, NAS, 홈서버, 컨테이너 호스팅이 필요합니다.
- 이 래퍼 프로젝트 코드는 MIT로 제공하지만, MUHAN 원본/복구본의 권리 조건은 별도로 확인해야 합니다.
