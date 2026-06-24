# syntax=docker/dockerfile:1.7

FROM --platform=linux/amd64 gcc:14 AS muhan-build
ARG MUHAN_REPO=https://github.com/comfuture/muhan.git
ARG MUHAN_REF=master

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git init muhan \
  && cd muhan \
  && git remote add origin "$MUHAN_REPO" \
  && git fetch --depth 1 origin "$MUHAN_REF" \
  && git checkout --detach FETCH_HEAD

WORKDIR /opt/muhan
RUN make -C src -j"$(nproc)" CC=gcc
RUN test -x /opt/muhan/src/frp.new

FROM --platform=linux/amd64 node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    MUHAN_HOME=/opt/muhan \
    MUHAN_HOST=127.0.0.1 \
    MUHAN_PORT=4102 \
    WEB_HOST=0.0.0.0 \
    WEB_PORT=8080

WORKDIR /app
COPY --from=muhan-build /opt/muhan /opt/muhan
COPY package.json ./package.json
COPY server ./server
COPY web ./web
COPY scripts ./scripts
COPY docker ./docker
COPY README.md LICENSE NOTICE.md ./

RUN chmod +x /app/docker/entrypoint.sh /app/scripts/*.js /app/scripts/*.sh

EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=20s --retries=3 \
  CMD node /app/scripts/healthcheck.js

ENTRYPOINT ["/app/docker/entrypoint.sh"]
