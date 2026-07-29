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

## Security posture

Security is a constraint on every phase, not a later pass. See the **Security
notes** in each `docs/PROGRESS.md` entry. Baseline: secrets via env only,
least-privilege DB role, parameterized queries (Prisma), per-user authorization
on every resource, and no secrets in logs. The full CI/DevSecOps pipeline
(lint, type-check, dependency audit, SAST) arrives in Phase 1.
