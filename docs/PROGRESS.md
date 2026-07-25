# Second Brain — Project Progress

This is the **single source of truth** for project history. Every phase appends one
dated section with three subsections — **What was done**, **How it was done**,
**What changed** — plus a **Security notes** line. Do not create a second
changelog/status file.

---

## Phase 0 — Research, ADR & Scaffolding — 2026-07-24

### What was done

- **AFFiNE / BlockSuite research** completed and recorded below (§ Research findings).
- **Architecture Decision Record (ADR)** written and approved (§ ADR).
- **Repository scaffolded** as an npm-workspaces monorepo that builds and boots:
  - Root workspace: `package.json` (workspaces `server`, `client`), `.gitignore`,
    `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `.nvmrc`, `README.md`,
    `.env.example`, `docker-compose.yml`.
  - `server/` — **NestJS** skeleton with a single `HealthModule` (`GET /health`),
    `tsconfig*.json`, `nest-cli.json`, and a **Prisma schema skeleton**
    (`prisma/schema.prisma`, datasource + generator only).
  - `client/` — **Vite + React + TypeScript** skeleton with a placeholder `App`.
- **`docs/PROGRESS.md`** initialized (this file).
- **Verified** end to end (§ Verification): `npm install` (0 vulnerabilities), both
  workspaces build, and the API serves `GET /health` → `200 {"status":"ok",...}`.

### How it was done

- **Monorepo via npm workspaces** (not pnpm) because the brief references
  `package-lock.json`; a single root `npm install` resolves both packages and one
  lockfile is committed.
- **Dependencies pinned to exact versions** (no `^`/`~`/`*`) per the dependency-hygiene
  rule. Versions were resolved from the npm registry at scaffold time.
- **TypeScript pinned to 5.9.3** (the stable line), deliberately _not_ the newest
  published `typescript@7.x` (the new native compiler), which the NestJS 11 / ts-node
  / React-Vite toolchains do not yet target. Avoids an ecosystem-compatibility gamble
  in the very first commit.
- **Two intentional scope refinements of the approved plan** (both documented here per
  the deviation rule; neither changes the ADR):
  1. **ESLint + full lint/type-check/audit/SAST tooling deferred to Phase 1.** The brief
     (§4, §6) gates the CI/DevSecOps pipeline at Phase 1, so Phase 0 ships **Prettier +
     EditorConfig** only. This also removes a class of ESLint 10 / typescript-eslint
     version-compat risk from the scaffold.
  2. **Prisma npm packages (`prisma`, `@prisma/client`) deferred to Phase 1.** They are
     unused in Phase 0 (the health check touches no DB) and `@prisma/client`'s install
     runs `prisma generate`, which errors on a model-less schema. The
     `prisma/schema.prisma` **skeleton file** still ships now to document the datasource
     contract; the packages + first models + migration land in Phase 1.
- **File-size discipline:** every source file is well under the 500-line cap; no splits
  were needed this phase.

### What changed

- **New repository** (first commit-ready state; `git init` on branch `main`, not yet
  committed — commits happen on request).
- **New dependencies** (all exact-pinned):
  - _server_ — runtime: `@nestjs/common` `@nestjs/core` `@nestjs/platform-express`
    `11.1.28`, `reflect-metadata` `0.2.2`, `rxjs` `7.8.2`; dev: `@nestjs/cli` `11.0.24`,
    `@nestjs/schematics` `11.1.0`, `@types/express` `5.0.6`, `@types/node` `24.13.3`,
    `typescript` `5.9.3`.
  - _client_ — runtime: `react` `react-dom` `19.2.8`; dev: `@types/react` `19.2.17`,
    `@types/react-dom` `19.2.3`, `@vitejs/plugin-react` `6.0.4`, `typescript` `5.9.3`,
    `vite` `8.1.5`.
  - _root_ — dev: `prettier` `3.9.6`.
- **Config/env:** `.env.example` added (keys only — `PORT`, `DATABASE_URL`,
  `SESSION_SECRET`, `POSTGRES_*`); `.env` is git-ignored. `docker-compose.yml` adds a
  local PostgreSQL (`postgres:17-alpine`) bound to `127.0.0.1` with credentials from
  `.env` (no defaults).
- **Prisma schema skeleton** added (no models yet).
- **Breaking changes:** none (greenfield).

### Security notes (Phase 0 scope)

- **CWE-798 / A05 (secrets):** no secrets in code, config, or images. `.env` git-ignored;
  `.env.example` holds keys only; DB credentials injected via env with no baked defaults.
- **CIS PostgreSQL / A02:** compose DB binds to loopback only (`127.0.0.1:5432`); schema
  comments mandate a least-privilege app role (not superuser) and SSL outside local dev.
- **A06 (vulnerable components):** all deps exact-pinned; lockfile committed;
  `npm audit` = **0 vulnerabilities** at scaffold time.
- **A03 / CWE-89 (injection):** DB access will go exclusively through Prisma
  (parameterized) — no raw string SQL. (No DB code exists yet.)
- Deferred by design to their gating phase: authn/authz (Phase 1), CSRF/session
  hardening (Phase 1), XSS sanitization of card content (Phase 4), CI SAST/secret
  scanning (Phase 1). Tracked, not forgotten.

---

## Phase 1 — Auth, Security Baseline & CI/DevSecOps — 2026-07-24

### What was done

- **Server-side session auth** — `POST /auth/register`, `POST /auth/login`,
  `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/csrf`.
- **Prisma `User` + `Session` models** and the first migration (`init_auth`).
- **Security middleware baseline** in a shared `configureApp()`: helmet, CORS
  allowlist (credentials), global allowlist `ValidationPipe`, cookie-parser,
  `@nestjs/throttler` rate limiting, `csrf-csrf` double-submit, per-account
  lockout, argon2id hashing, `HttpOnly; Secure; SameSite=Strict` session cookie,
  a body-free logging interceptor, and fail-fast env validation.
- **`SessionAuthGuard`** (deny-by-default) + **`@CurrentUser()`** decorator.
- **Tests:** 10 unit (password + session services) and 8 e2e (full lifecycle,
  CSRF, allowlist validation, duplicate, generic-401, lockout, rate-limit) — all
  passing against a real Postgres.
- **CI/DevSecOps skeleton** — `.github/workflows/ci.yml` (lint, type-check,
  build, migrate, unit + e2e, `npm audit`, Semgrep SAST, gitleaks secret scan).

### How it was done

- **Prisma 7** (Rust-free). Its breaking changes were handled: generator switched
  to `prisma-client` (emits TS under `src/generated/prisma`, `moduleFormat=cjs`);
  the datasource `url` moved out of the schema into `prisma.config.ts` (which
  loads the repo-root `.env` explicitly, since Prisma 7 no longer auto-loads it);
  the runtime client uses the `@prisma/adapter-pg` driver adapter; `migrate` no
  longer auto-generates, so `generate` is an explicit step.
- **Sessions:** opaque 256-bit CSPRNG token; only its **SHA-256 hash** is stored
  (fast, indexed equality lookup — argon2 would break indexing); a new token is
  minted on login (anti-fixation) and on refresh (sliding expiry bounded by an
  absolute cap); logout sets `revokedAt`.
- **CSRF** is bound to the session (`getSessionIdentifier` = sha256 of the session
  cookie), so the token is re-fetched after each auth-state change — the e2e
  suite and the future SPA both follow this.
- **Enumeration/timing:** identical generic 401 for unknown-email / wrong-password
  / locked; a fixed dummy argon2 verify runs on the unknown-email path.
- **Three fixes found via verification:** (1) a transitive `find-my-way` DDoS
  advisory (dev-only, via the Prisma CLI) pinned to `9.7.0` via an npm `override`
  → `npm audit` back to **0**; (2) `PORT` env coercion (`@Type(() => Number)`, as
  `enableImplicitConversion` didn't convert the string); (3) a `csrf` method/field
  name collision in the controller.
- **`configureApp()`** is shared by `main.ts` and the e2e tests so the test app is
  wired exactly like production. Every source file stays under the 500-line cap.

### What changed

- **New dependencies** (exact-pinned): server runtime — `@prisma/client`,
  `@prisma/adapter-pg`, `pg`, `@nestjs/config` `4.0.4`, `@nestjs/throttler`
  `6.5.0`, `@node-rs/argon2` `2.0.2`, `class-validator` `0.15.1`,
  `class-transformer` `0.5.1`, `helmet` `8.3.0`, `cookie-parser` `1.4.7`,
  `csrf-csrf` `4.0.3`; server dev — `prisma`/`@prisma/adapter-pg`/`@prisma/client`
  `7.9.0`, `dotenv`, `tsx`, `jest` `30`, `ts-jest` `29.4.12`, `supertest` `7.2.2`,
  `@nestjs/testing`, and types; root dev — the ESLint 10 + typescript-eslint 8.65
  stack. Added a root `overrides` pin for `find-my-way` `9.7.0`.
- **Schema:** `User` and `Session` models + `init_auth` migration (committed under
  `server/prisma/migrations/`).
- **Env/config:** `.env.example` gained `NODE_ENV`, `CORS_ORIGINS`, `DB_HOST_PORT`;
  the docker host port is now overridable (`${DB_HOST_PORT:-5432}`) to avoid
  clashing with a locally-installed Postgres.
- **Scripts:** root `lint` + `typecheck`; server `typecheck`, `prisma:*`, `test`,
  `test:e2e`. `.gitignore` now ignores `server/src/generated/` (Prisma 7 output).
- **Breaking changes:** none (additive; the Phase 0 health check is unchanged
  except `@SkipThrottle`).

### Security notes (Phase 1 scope)

- **A07/CWE-287 auth:** argon2id (OWASP params), per-account exponential lockout,
  per-IP throttling, session rotation + revocation, enumeration-safe/timing-uniform.
- **A01/CWE-862/863 authz:** deny-by-default `SessionAuthGuard`; `/me`,`/refresh`,
  `/logout` guarded, `/register`,`/login` public. (Resource-level IDOR checks land
  with projects/cards in Phase 2.)
- **A02/CIS:** session token stored only as a hash; `HttpOnly; Secure(prod);
SameSite=Strict` cookie; least-privilege DB role + SSL documented for prod.
- **CWE-352 CSRF:** `csrf-csrf` double-submit on all state-changing routes (e2e
  asserts 403 without a token).
- **A03/CWE-89:** all DB access via Prisma (parameterized).
- **A05/CWE-798 secrets:** env-only; `.env` git-ignored; gitleaks in CI.
- **A06 components:** exact pins + committed lockfile; `npm audit` = **0**; Semgrep
  SAST + `npm audit --audit-level=high` gate CI.
- **A09 logging:** interceptor logs method/path/status/latency only — never bodies,
  headers, cookies, or query strings.

### Verification (Phase 1)

| Check                  | Result                                                          |
| ---------------------- | --------------------------------------------------------------- |
| `npm audit`            | ✅ **0 vulnerabilities** (after `find-my-way` override)         |
| `prisma migrate dev`   | ✅ `init_auth` created + applied                                |
| `npm run format:check` | ✅ pass                                                         |
| `npm run lint`         | ✅ 0 problems                                                   |
| `npm run typecheck`    | ✅ server + client pass                                         |
| `npm run build`        | ✅ server + client                                              |
| Unit tests (`jest`)    | ✅ **10/10** (password + session)                               |
| e2e (`supertest`)      | ✅ **8/8** against Postgres                                     |
| Runtime smoke (curl)   | ✅ full flow; `/me` has no `passwordHash`; logout→401; CSRF→403 |

### Known residual risks / follow-ups

- **`SameSite=Strict` needs SPA + API same-site.** Recommend one origin behind a
  reverse proxy in prod and the Vite dev proxy in dev; revisit before choosing
  hosting. If forced cross-site, cookies must become `SameSite=None; Secure`.
- **Local dev DB** connects as the container owner role; the runtime/least-privilege
  role split is deferred to the Phase 5 hardening pass.
- **CSRF token re-fetch** after login/refresh is required (session-bound); the SPA
  will retry on 403. Documented so it isn't mistaken for a bug.
- e2e uses the dev DB with unique emails (accumulates rows); CI uses a fresh
  Postgres service container each run.

### Phase gate

Phase 1 is complete. **Awaiting explicit approval to begin Phase 2** (project
[workspace] CRUD, per-user authorization / IDOR protection, and the project-list
UI — plus the login/register UI that Phase 1 intentionally deferred).

---

## Phase 2 — Projects (Workspaces): CRUD, Authorization & UI — 2026-07-25

### What was done

- **Project CRUD API** — `POST /api/projects`, `GET /api/projects`,
  `GET/PATCH/DELETE /api/projects/:id`, all guarded by the Phase 1
  `SessionAuthGuard` + `@CurrentUser` and scoped to the owner.
- **Prisma `Project` model** + `add_projects` migration (cascade-deletes with its
  owner).
- **Global `/api` prefix** (health stays at `/health`) enabling the same-origin
  SPA↔API layout.
- **Frontend**: login/register/logout UI, a `ProtectedRoute`, and the projects
  list/create/rename/delete UI — React Router + React Query (server state) +
  a CSRF-aware fetch client over the Vite `/api` proxy.
- **Tests**: +5 unit (projects service) and +4 e2e (CRUD + two-user IDOR + 401);
  Phase 1 auth e2e updated to `/api`. Totals: **15 unit + 12 e2e**, all green.
- **CI**: the dependency-audit gate is now `audit-ci` with a reviewed allowlist.

### How it was done

- **IDOR protection (the phase's core):** every `ProjectsService` query is
  owner-scoped; `/:id` resolves through `getOwned()`, which throws
  `NotFoundException` (404, not 403) for a project the caller doesn't own — a
  guessed id can't confirm existence. The e2e suite proves user B gets 404 on
  user A's project for read/update/delete and never sees it listed.
- **Same-site cookies:** the `/api` prefix + Vite dev proxy (`/api` →
  `localhost:3000`) make the SPA and API same-origin, so `SameSite=Strict`
  cookies flow in dev exactly as behind one reverse proxy in prod.
- **Client:** `apiFetch` sends credentials and attaches `X-CSRF-Token` on
  mutations, refreshing the (session-bound) token once on a 403 and retrying.
  React Query owns `me`/`projects` server state with cache invalidation on
  mutations; Zustand is reserved for canvas state (Phase 3+). Register auto-logs
  in. Project names render via React escaping only (no `dangerouslySetInnerHTML`).
- **Small choices:** `UpdateProjectDto` written by hand (avoided a
  `@nestjs/mapped-types` dependency); `ParseUUIDPipe` on `:id`.
- **Dependency-audit work (important):** installing the client surfaced real
  advisories. A `react-router-dom` downgrade to `7.11.0` _reintroduced_ serious
  SPA vulns (XSS/RCE) in the `6.0.0–7.17.0` range, so it was reverted to
  **7.18.1** (patched against those; only an unreachable RSC-mode CSRF remains).
  Introduced **`audit-ci`** with an allowlist so CI blocks _new_ high/critical
  advisories while permitting the documented, currently-unfixable, unreachable
  ones (see Security notes).

### What changed

- **New dependencies** (exact-pinned): client — `@tanstack/react-query` `5.101.4`,
  `react-router-dom` `7.18.1`, `zustand` `5.0.14`; root dev — `audit-ci` `7.1.0`.
- **Schema:** `Project` model + `add_projects` migration.
- **Routing:** all API routes now under **`/api`** (health at `/health`); the SPA
  calls same-origin `/api/*` through the Vite proxy. Phase 1 e2e paths updated.
- **New files:** `audit-ci.jsonc` (allowlist) + root `audit` script; the whole
  `client/src/{api,hooks,pages,components}` tree.
- **Breaking:** the API base path moved to `/api` (internal; e2e updated).

### Security notes (Phase 2 scope)

- **A01 / CWE-639/862/863 (IDOR):** owner-scoped queries; 404 for non-owned;
  cross-user isolation proven by e2e.
- **A07 / CWE-287:** all project routes require a session (401 otherwise).
- **CWE-352 CSRF:** double-submit token on every mutation; client auto-refresh on 403.
- **CWE-79 XSS:** user-supplied project names rendered through React escaping only.
- **A03 / CWE-89:** all DB access via Prisma (parameterized).
- **A06 (vulnerable components):** `audit-ci` blocks new high/critical. **Waivers**
  (justification · compensating control · review by ~2026-10-31):
  - `GHSA-qwww-vcr4-c8h2` (react-router, high) — RSC-mode CSRF only; we use
    client-side SPA routing, not RSC, so it is not reachable. Our own
    `csrf-csrf` double-submit protects the API independently. No patched version
    above the affected range exists yet.
  - `GHSA-mh99-v99m-4gvg` (brace-expansion, high) — dev-only build/test tooling
    (jest, `@nestjs/cli`), not in the shipped bundle; only processes our own glob
    patterns. The only fix (`5.0.8`) is an ESM break for `minimatch@3` consumers.
  - `GHSA-5qjj-4xww-7phc` (valibot, moderate) — via the Prisma CLI (dev); moderate,
    below the high gate. Tracked.

### Verification (Phase 2)

| Check                     | Result                                                       |
| ------------------------- | ------------------------------------------------------------ |
| `prisma migrate dev`      | ✅ `add_projects` applied                                    |
| format / lint / typecheck | ✅ all pass (server + client)                                |
| build (server + client)   | ✅                                                           |
| Unit tests                | ✅ **15/15** (auth + session + projects)                     |
| e2e tests (vs Postgres)   | ✅ **12/12** (incl. two-user IDOR → 404, 401-unauth)         |
| `audit-ci` gate           | ✅ no un-allowlisted high/critical                           |
| Live proxy integration    | ✅ `localhost:5173/` → 200, `/api/auth/csrf` via proxy → 200 |

### Residual risks / follow-ups

- The react-router RSC advisory is tracked; bump when a fix ships above the range.
- Rename/delete use `window.prompt`/`confirm` (MVP); richer modals can come later.
- e2e uses the dev DB with unique emails; CI uses a fresh Postgres service container.

### Phase gate

Phase 2 is complete. **Awaiting explicit approval to begin Phase 3** (whiteboard
canvas foundation: pan/zoom, viewport, and the spatial-index scaffolding — no
cards yet).

---

## Research findings — AFFiNE / BlockSuite

Legend: **[V]** verified from the cited repo/docs · **[I]** reasoned inference.

### Workspace & document hierarchy

- **[V]** `Workspace` → many `Docs` (pages) → each Doc is a **block tree**. A workspace is
  the top-level sync/permission boundary; local vs. cloud workspaces differ by whether
  data syncs. → _Maps to our `Project → Cards`; the full block tree is out of MVP scope._
- Sources: docs.affine.pro (workspaces, docs), blocksuite.io "Working with Block Tree".

### Block/document data model (BlockSuite)

- **[V]** Every block has an `id` + a `namespace:name` **flavour** (`affine:page`,
  `affine:note`, `affine:paragraph`…) and nests parent→child. `Doc` exposes
  `addBlock/updateBlock/deleteBlock/getBlockById`; history is auto-recorded.
- Sources: blocksuite.io "Working with Block Tree", `@blocksuite/store` guide.

### Edgeless (whiteboard) internals — verified from `toeverything/blocksuite@main`

- **[V] Camera = `{center:{x,y}, zoom}`** over an _unbounded float world_
  (`packages/framework/std/src/gfx/viewport.ts`); zoom clamped `0.1–6.0`; screen↔world via
  `model = viewportXY + (client − offset)/zoom`. → _We adopt this camera model._
- **[V]** Elements carry an **`xywh`** string bound (`[x,y,w,h]`, world space). → _Card
  stores `x,y,w,h` floats._
- **[V] Z-order via fractional indexing** (`fractional-indexing` pkg; "the technique Figma
  uses") — O(1) local reorder, merge-friendly (`gfx/layer.ts`). → _Card stacking uses a
  fractional string index._
- **[V] Spatial index = a UNIFORM GRID, not an R-tree.** `gfx/grid.ts` `GridManager`:
  fixed `3000`-unit cells keyed `"row|col"` in a `Map` of `Set`s; elements register into
  every overlapping cell; `search(bound)` scans only covering cells. **The common
  "AFFiNE uses rbush/R-tree" claim is false** — `grep rbush` over both lockfiles returns
  zero. → _Directly validates our uniform-grid DSA choice._
- **[V] Rendering = layered Canvas2D (rough.js) + interleaved DOM.** Notes/cards/images
  render as **DOM**; pure shapes to canvas; culling = `grid.search(viewport.viewportBounds)`
  (`.../surface/src/renderer/canvas-renderer.ts`). → _Validates our DOM-cards approach._
- Sources: blocksuite.io "Edgeless Data Structure" / "Surface Block"; the cited source files.

### Local-first sync

- **[V]** Local-first via **Yjs CRDT** (each Doc = a Yjs subdocument; pluggable providers:
  IndexedDB local, WebSocket cloud; AFFiNE's native engine is Rust `y-octo`). → _Noted as
  INSPIRATION only; our MVP uses save-on-change, not CRDT (ADR D10)._

### AFFiNE's own stack (factual)

- **[V]** Server: **NestJS 11 + Express 5 + Apollo GraphQL + Prisma 6 + PostgreSQL + Redis**,
  JWT auth, Rust via napi-rs. Client: **React + Vite + Jotai + Electron**. → _We mirror the
  server (NestJS/Prisma/Postgres) and diverge where the MVP is simpler: REST not GraphQL,
  sessions not JWT, no CRDT._

---

## ADR — decisions & rationale

| #   | Decision                 | Choice                                                           | Rationale (short)                                                                                                                                                                       |
| --- | ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Backend framework        | **NestJS** (Node + TS)                                           | Guards→authz, Pipes→validation, Interceptors→logging map onto the security reqs; modular; mirrors AFFiNE.                                                                               |
| D2  | ORM / DB                 | **Prisma + PostgreSQL**                                          | Brief default; parameterized queries (no CWE-89); migrations; least-privilege role, SSL (CIS).                                                                                          |
| D3  | API style                | **REST/JSON** (not GraphQL)                                      | Simpler, smaller attack surface, per-route authz is easy to reason about for MVP CRUD.                                                                                                  |
| D4  | Auth session             | **Server-side sessions**                                         | Opaque id in `HttpOnly; Secure; SameSite=Strict` cookie, DB-backed; trivial revocation; XSS-safe.                                                                                       |
| D5  | Password hashing         | **argon2id** (fallback bcrypt ≥12)                               | OWASP-preferred; passwords ≥12 chars.                                                                                                                                                   |
| D6  | Input validation         | **class-validator + Nest `ValidationPipe`** (allowlist)          | Idiomatic Nest DTO validation; `nestjs-zod` is the fallback if the team prefers Zod.                                                                                                    |
| D7  | Frontend                 | **React + TS + Vite**, **Zustand** for canvas state              | Required stack; Zustand suits high-frequency drag updates without boilerplate.                                                                                                          |
| D8  | Canvas rendering         | **Hand-rolled: DOM cards in one CSS-`transform`ed viewport**     | Trivial rich-text editing, full control of the DSA work, mirrors AFFiNE's DOM notes.                                                                                                    |
| D9  | **Spatial index (DSA)**  | **Uniform grid / spatial hash** (`Map<"col\|row", Set<CardId>>`) | Build O(n); update/drag O(1) avg; viewport query O(cells+hits). Powers culling, hit-testing, drag queries. AFFiNE-proven; quadtree rejected (drag churn, boundary-spanning complexity). |
| D10 | Position/content persist | **Save-on-change** (optimistic + debounced), no CRDT             | 60fps local drag, zero network; `PATCH` on drag-end / debounced edits. CRDT/Yjs is the future multiplayer path.                                                                         |

**Provisional data model** (finalized Phase 1/2): `User(id, email uniq, passwordHash, …)`,
`Session(id, userId→User, expiresAt, revokedAt?)`, `Project(id, ownerId→User, name, …)`,
`Card(id, projectId→Project, x, y, w, h, zIndex, content, …)`. Every project/card query is
**scoped to the authenticated user** (deny-by-default) → no IDOR (CWE-639/862/863).

### DSA note — spatial index complexity (the whiteboard's core data structure)

Uniform grid / spatial hash over card bounding boxes:

| Operation                | Cost                      | Notes                                           |
| ------------------------ | ------------------------- | ----------------------------------------------- |
| Build (n cards)          | `O(n)`                    | insert each card into its overlapping cells     |
| Insert / remove / update | `O(1)` avg                | proportional to cells a card's bbox covers      |
| Drag move                | `O(1)` avg                | remove from old cells, add to new cells         |
| Viewport query (culling) | `O(cells_in_view + hits)` | scan only cells overlapping the viewport rect   |
| Point hit-test           | `O(cell_occupancy)`       | candidates in the pointer's cell, then geometry |

Weak spot: dense clustering degrades a cell to a large bucket → mitigated by cell-size
tuning (~512 world px) and, if ever needed, a quadtree fallback for pathological density.

---

## Verification (Phase 0)

| Check                              | Result                                             |
| ---------------------------------- | -------------------------------------------------- |
| `npm install` (workspaces)         | ✅ 368 packages, **0 vulnerabilities**             |
| `npm run build --workspace server` | ✅ `nest build` exit 0                             |
| `npm run build --workspace client` | ✅ `tsc -b && vite build` exit 0 (~191 kB bundle)  |
| `GET /health`                      | ✅ HTTP **200**, `{"status":"ok","uptime":…}`      |
| `docker compose config`            | ✅ valid                                           |
| Secrets in tree                    | ✅ none; `.env` git-ignored; `.env.example` = keys |
| 500-line/file cap                  | ✅ all source files well under                     |

How to reproduce: `npm install` → `npm run build` → (`cd server && PORT=3100 node dist/main.js`
then `curl 127.0.0.1:3100/health`). Local DB: fill `.env` from `.env.example`, then
`docker compose up -d`.

### Phase gate

Phase 0 is complete. **Awaiting explicit approval to begin Phase 1** (auth: register/login/
refresh/logout, user + session models, security middleware baseline, CI/DevSecOps skeleton).
