# Optional vendored MUHAN upstream

이 디렉터리는 선택 사항입니다.

Docker 빌드 환경에서 GitHub 접근이 막히는 경우, 호스트에서 upstream을 이 위치에 받아두면 Dockerfile이 네트워크 clone 대신 이 로컬 소스를 사용합니다.

```bash
rm -rf vendor/muhan
mkdir -p vendor
git clone --depth 1 https://github.com/comfuture/muhan.git vendor/muhan
```

주의: MUHAN 원본/복구본의 권리 조건은 이 래퍼 프로젝트와 별도입니다. 공개 저장소에 vendoring하기 전에 upstream의 권리 조건을 확인하세요.
