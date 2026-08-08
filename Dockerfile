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
