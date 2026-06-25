# syntax=docker/dockerfile:1.7

# MUHAN build and Node runtime use the same Debian generation to reduce
# libc/symbol-version mismatch risk for the restored legacy C binary.
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
ARG INSTALL_AGY=0
ENV NODE_ENV=production \
    APP_VERSION=0.9.0 \
    PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    MUHAN_HOME=/opt/muhan \
    MUHAN_HOST=127.0.0.1 \
    MUHAN_PORT=4102 \
    WEB_HOST=0.0.0.0 \
    WEB_PORT=8080 \
    TELNET_FILTER=1 \
    HEALTHCHECK_TARGET=0 \
    ENABLE_AGENT=0 \
    AGENT_COMMAND=agy \
    AGENT_WORKDIR=/workspace \
    AGENT_MAX_SESSIONS=1 \
    AGENT_IDLE_TIMEOUT_MS=3600000 \
    AGENT_USE_SCRIPT=1 \
    AGENT_LOCAL_ONLY=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates procps curl git bash tini python3 util-linux \
  && rm -rf /var/lib/apt/lists/*

# Optional Antigravity CLI install. Disabled by default so ordinary Docker builds
# do not depend on the external installer. Enable with INSTALL_AGY=1.
RUN set -eux; \
  if [ "$INSTALL_AGY" = "1" ]; then \
    curl -fsSL https://antigravity.google/cli/install.sh | bash; \
    if [ -x /root/.local/bin/agy ]; then ln -sfn /root/.local/bin/agy /usr/local/bin/agy; fi; \
    agy --version || true; \
  else \
    echo "[build] Antigravity CLI install skipped. Set INSTALL_AGY=1 to install agy."; \
  fi

WORKDIR /app
COPY --from=muhan-build /opt/muhan /opt/muhan
COPY package.json ./package.json
COPY server ./server
COPY web ./web
COPY scripts ./scripts
COPY docker ./docker
COPY docs ./docs
COPY README.md LICENSE NOTICE.md CHANGELOG.md ./

RUN chmod +x /app/docker/entrypoint.sh /app/scripts/*.js /app/scripts/*.sh /app/server/pty_bridge.py \
  && mkdir -p /workspace /home \
  && ln -sfn /opt/muhan /home/muhan

EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=30s --retries=3 \
  CMD node /app/scripts/healthcheck.js

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
