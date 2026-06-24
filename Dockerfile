# syntax=docker/dockerfile:1.7

# Keep the MUHAN build image and the Node runtime image on the same Debian
# generation. gcc:14 is currently published as a Trixie image, so the runtime
# is node:22-trixie-slim to avoid glibc/symbol-version mismatches.
FROM --platform=linux/amd64 gcc:14-trixie AS muhan-build
ARG MUHAN_REPO=https://github.com/comfuture/muhan.git
ARG MUHAN_REF=master

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Optional offline/vendor path. If vendor/muhan contains a checked-out upstream
# tree with src/Makefile, the build uses it and does not contact GitHub.
COPY vendor/muhan/ /tmp/vendor-muhan/

WORKDIR /opt
RUN set -eux; \
  if [[ -f /tmp/vendor-muhan/src/Makefile ]]; then \
    echo "Using vendored upstream from vendor/muhan"; \
    mkdir -p /opt/muhan; \
    cp -a /tmp/vendor-muhan/. /opt/muhan/; \
  else \
    echo "Fetching upstream ${MUHAN_REPO}@${MUHAN_REF}"; \
    git init muhan; \
    cd muhan; \
    git remote add origin "${MUHAN_REPO}"; \
    git fetch --depth 1 origin "${MUHAN_REF}"; \
    git checkout --detach FETCH_HEAD; \
  fi

WORKDIR /opt/muhan
RUN set -eux; \
  test -f src/Makefile; \
  make -C src clean >/dev/null 2>&1 || true; \
  make -C src -j"$(nproc)" CC=gcc; \
  test -x /opt/muhan/src/frp.new; \
  ldd /opt/muhan/src/frp.new || true

FROM --platform=linux/amd64 node:22-trixie-slim AS runtime
ENV NODE_ENV=production \
    MUHAN_HOME=/opt/muhan \
    MUHAN_HOST=127.0.0.1 \
    MUHAN_PORT=4102 \
    WEB_HOST=0.0.0.0 \
    WEB_PORT=8080 \
    TELNET_FILTER=1 \
    HEALTHCHECK_TARGET=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates procps \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=muhan-build /opt/muhan /opt/muhan
COPY package.json ./package.json
COPY server ./server
COPY web ./web
COPY scripts ./scripts
COPY docker ./docker
COPY docs ./docs
COPY README.md LICENSE NOTICE.md CHANGELOG.md ./

RUN chmod +x /app/docker/entrypoint.sh /app/scripts/*.js /app/scripts/*.sh

EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=30s --retries=3 \
  CMD node /app/scripts/healthcheck.js

ENTRYPOINT ["/app/docker/entrypoint.sh"]
