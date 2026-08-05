# syntax=docker/dockerfile:1

# Single image that serves BOTH the built React SPA and the NestJS API from one
# Node process (NestJS serves the client from the same origin — required by the
# SameSite=Strict cookie design). The database is NOT in here: point DATABASE_URL
# at your Postgres (e.g. host.docker.internal:5432) at run time.
#
# Base image pinned by digest (no :latest), multi-stage, runs as non-root.

# ---- Build stage: install, generate Prisma client, build server + client ----
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder
WORKDIR /app

# Identifies WHICH commit produced this image; surfaced by GET /health so a stale
# container is one curl away from being spotted. Defaults to `dev` so a plain
# `docker build` with no --build-arg still succeeds.
ARG GIT_SHA=dev

# Install workspace deps first for layer caching (only re-runs when manifests change).
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

# Build both workspaces, then drop devDependencies from node_modules.
# `prisma generate` resolves env('DATABASE_URL') from prisma.config.ts but never
# connects — a throwaway build-time value satisfies it (not a secret; not kept).
COPY . .
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    npm run prisma:generate --workspace server \
  && npm run build \
  && npm prune --omit=dev

# ---- Runtime stage: minimal, non-root, prod-only deps ----
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runner
WORKDIR /app

# An ARG must be re-declared in every stage that uses it — it does not cross stages.
ARG GIT_SHA=dev

ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST=/app/client/dist \
    UPLOAD_DIR=/app/uploads \
    BUILD_SHA=${GIT_SHA}

# Prod node_modules + compiled server (incl. generated Prisma client) + built SPA.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/server/package.json ./server/package.json
COPY --from=builder --chown=node:node /app/server/dist ./server/dist
COPY --from=builder --chown=node:node /app/client/dist ./client/dist

# Uploaded image BYTES live here (metadata is in Postgres). Mount a host volume to
# persist them across container restarts.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 3000

# DB-independent liveness probe (see health module).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "server/dist/main.js"]
