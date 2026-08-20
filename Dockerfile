# syntax=docker/dockerfile:1

FROM node:26-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/tsconfig.build.json packages/shared/
COPY packages/shared/src packages/shared/src/
COPY packages/shared/scripts packages/shared/scripts/

RUN npm ci

COPY . .

# `main-only` (production / CI): single SPA at `/`.
# `full` (legacy): also build an empty-or-/hackathon/ second bundle for local dual-path experiments.
# Omit VITE_API_BASE_URL so the bundle uses same-origin `/api/...` (see apps/web/src/state/diagramStore.js).
RUN npm run build -w packages/shared && npm run build -w apps/server

ENV VITE_API_BASE_URL=
ENV VITE_BASE_PATH=/
RUN npm run build -w apps/web && mv apps/web/dist apps/web/dist-main

# ARG placed here so changing UI_VARIANT invalidates only this layer (not entire npm ci cache).
ARG UI_VARIANT=main-only
RUN if [ "$UI_VARIANT" = "full" ]; then \
  VITE_BASE_PATH=/hackathon/ npm run build -w apps/web && mv apps/web/dist apps/web/dist-hackathon; \
else \
  mkdir -p apps/web/dist-hackathon; \
fi

RUN npm prune --omit=dev

FROM node:26-bookworm-slim AS runner
WORKDIR /app

# Chromium powers the Anything runtime check (apps/server/src/tools/anythingRuntimeBrowser.js),
# which executes agent-generated pages inside the same sandboxed iframe the client
# renders them in. It replaces the jsdom child process rather than running beside it:
# measured p50 through the full ladder is ~139ms against ~1009ms for jsdom, and peak
# RSS ~215MB against jsdom's 256MB heap cap.
#
# Debian's package (rather than a Playwright download) keeps the browser out of the
# production npm dependency tree and lets apt resolve the shared libraries. The server
# finds it at /usr/bin/chromium via resolveAnythingBrowserBinary; no path is hardcoded
# anywhere else. If this layer is ever dropped, the runtime check falls back to jsdom
# automatically — the gate degrades, it does not break.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/web/dist-main ./apps/web/dist-main
COPY --from=builder /app/apps/web/dist-hackathon ./apps/web/dist-hackathon

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
