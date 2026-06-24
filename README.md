# 무한대전 Web Runner

무한대전(MUHAN) 레거시 MUD 복구본을 **브라우저에서 실행/접속**할 수 있게 만드는 GitHub 업로드용 래퍼 프로젝트입니다.

구조는 단순합니다.

```text
Browser
  └─ WebSocket /ws
      └─ Node.js gateway
          └─ TCP 127.0.0.1:4102
              └─ MUHAN frp.new
```

원본 MUD 서버는 가능한 한 건드리지 않고, 웹 접속 레이어만 덧붙입니다.

## 포함된 것

- Docker 기반 MUHAN 빌드 및 실행
- 브라우저용 텍스트 터미널 UI
- WebSocket ↔ TCP 프록시 게이트웨이
- `/healthz` 헬스체크
- 선택형 `ACCESS_TOKEN` 접속 제한
- GitHub Actions CI 예시
- GitHub 업로드용 문서/구조

## 빠른 실행

```bash
cp .env.example .env
docker compose up --build
```

브라우저에서 접속합니다.

```text
http://localhost:8080
```

## 공개 서버로 열 때

`.env`에서 토큰을 설정하세요.

```env
ACCESS_TOKEN=change-this-long-random-token
```

이 값을 설정하면 브라우저 화면의 “접속 토큰” 칸에 같은 토큰을 입력해야 WebSocket 접속이 됩니다.

## upstream 소스 고정

기본값은 `comfuture/muhan`의 `master` 브랜치를 Docker 빌드 시점에 가져옵니다.

```env
MUHAN_REPO=https://github.com/comfuture/muhan.git
MUHAN_REF=master
```

재현 가능한 배포가 필요하면 `MUHAN_REF`를 브랜치명이 아니라 특정 커밋 SHA로 고정하세요.

## GitHub에 올리기

```bash
git init
git add .
git commit -m "Add MUHAN web runner"
git branch -M main

# GitHub CLI 사용 시
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

## 운영 메모

- Docker Compose는 외부에 `8080`만 노출합니다. MUHAN TCP 포트 `4102`는 컨테이너 내부에서만 사용합니다.
- GitHub Pages만으로는 실행할 수 없습니다. MUD 서버와 WebSocket 프록시가 필요하므로 Docker를 실행할 수 있는 VPS, NAS, 홈서버, Fly.io/Render/Railway류의 컨테이너 호스팅이 필요합니다.
- 이 래퍼 프로젝트의 코드는 MIT로 제공하지만, MUHAN 원본/복구본의 권리 조건은 별도로 확인해야 합니다.

## 주요 명령

```bash
make check      # Node 문법 검사
make build      # Docker 이미지 빌드
make run        # 빌드 후 실행
make logs       # 로그 보기
make down       # 중지
```
