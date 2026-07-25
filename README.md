# Second Brain

An AFFiNE-inspired "second brain" app: each **project** contains an infinite,
pannable/zoomable **whiteboard** of freely-positioned **cards**. Built local-first
in spirit, security-first in practice.

> **Status:** Phase 4 (cards — CRUD, drag/edit/delete, wired into the uniform-grid spatial index) complete.
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
├─ server/           # NestJS API (health module only in Phase 0)
├─ client/           # Vite + React + TS app (placeholder in Phase 0)
├─ docker-compose.yml# local PostgreSQL for development
└─ .env.example      # env template (keys only — never commit real secrets)
```

## Getting started (local dev)

Prerequisites: Node.js ≥ 20.19 (see `.nvmrc`), npm, Docker.

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure environment
cp .env.example .env      # then fill in values

# 3. Start the local database (optional in Phase 0 — not yet used)
docker compose up -d

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
