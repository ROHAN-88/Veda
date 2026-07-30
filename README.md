# Second Brain

An AFFiNE-inspired "second brain" app: each **project** contains an infinite,
pannable/zoomable **whiteboard** of freely-positioned **cards**. Built local-first
in spirit, security-first in practice.

> **Status:** Phase 9 (JSON export/import + read-only public share links, with a read-only
> canvas mode) complete; builds on Phase 8 multi-select/undo-redo, Phase 7 Markdown, Phase 6
> hardening, and the earlier cards/arrows work.
> See [`docs/PROGRESS.md`](docs/PROGRESS.md) — the single source of truth for
> project history and the full Architecture Decision Record (ADR).

## Stack

| Layer      | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Backend    | NestJS (Node + TypeScript), REST/JSON                       |
| Database   | PostgreSQL via Prisma (wired in Phase 1)                    |
| Auth       | Server-side sessions, `HttpOnly; Secure; SameSite=Strict`   |
| Frontend   | React + TypeScript + Vite, Zustand for canvas state         |
| Whiteboard | Hand-rolled DOM cards on a CSS-transformed viewport         |
| Spatial    | Uniform grid / spatial hash for culling + hit-testing (DSA) |

## Repository layout

```
.
├─ docs/PROGRESS.md   # source of truth: history + ADR
├─ server/           # NestJS API
├─ client/           # Vite + React + TS app
└─ .env.example      # env template (keys only — never commit real secrets)
```

## Getting started (local dev)

Prerequisites: Node.js ≥ 20.19 (see `.nvmrc`), npm, and a **PostgreSQL ≥ 14 server installed and
running locally** (default port 5432). No database is bundled — the app connects via `DATABASE_URL`.

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure environment
cp .env.example .env      # then set DATABASE_URL, SESSION_SECRET, CORS_ORIGINS

# 3. One-time: create the database + a least-privilege role in your local Postgres,
#    matching the credentials in DATABASE_URL. For example, as a superuser:
#      CREATE ROLE sb_app LOGIN PASSWORD '<choose-a-password>';
#      CREATE DATABASE secondbrain OWNER sb_app;
#    then apply the schema:
npm run prisma:deploy --workspace server

# 4. Run the API and the web app (separate terminals)
npm run dev:server        # http://localhost:3000/health
npm run dev:client        # http://localhost:5173
```

## Run the whole app in one Docker image

A single multi-stage image builds the client + server and runs **both** from one Node process — NestJS
serves the built SPA and the API on the same origin (port 3000). The database is **not** in the image;
the container reaches your host Postgres via `host.docker.internal`.

```bash
# Build
docker build -t second-brain .

# Apply migrations from the host first:  npm run prisma:deploy --workspace server
# Then run (Postgres runs natively on your host):
docker run --rm -p 3000:3000 \
  -e NODE_ENV=development \
  -e SESSION_SECRET='<32+ character secret>' \
  -e CORS_ORIGINS='http://localhost:3000' \
  -e DATABASE_URL='postgresql://sb_app:<password>@host.docker.internal:5432/secondbrain?schema=public' \
  -v second-brain-uploads:/app/uploads \
  second-brain
# → http://localhost:3000  (SPA + /api + /health)
```

Cards can hold Markdown plus **uploaded images**, **YouTube/Vimeo video embeds**, and **links** (use
the Image / Video / Link buttons while editing a card). Uploaded image _bytes_ are stored on disk under
`UPLOAD_DIR` (only metadata is in Postgres) — mount a volume (above) so they persist across restarts.

Notes:

- **Host database:** allow the Docker bridge subnet in your Postgres `pg_hba.conf` and ensure
  `listen_addresses` covers the Docker gateway, so the container can reach `host.docker.internal:5432`.
- **Cookies over HTTP:** `NODE_ENV=production` sets `Secure`/`__Host-` cookies that browsers drop on
  plain `http://` — for a local run use `NODE_ENV=development` (above); for real production put the
  container behind TLS and keep `production`.
- Secrets are passed at run time only — never baked into the image (`.env` is `.dockerignore`d).

## Security posture

Security is a constraint on every phase, not a later pass. See the **Security
notes** in each `docs/PROGRESS.md` entry. Baseline: secrets via env only,
least-privilege DB role, parameterized queries (Prisma), per-user authorization
on every resource, and no secrets in logs. The full CI/DevSecOps pipeline
(lint, type-check, dependency audit, SAST) arrives in Phase 1.
