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

## Phase 3 — Whiteboard Canvas Foundation (pan/zoom + spatial-index scaffolding) — 2026-07-25

### What was done

- A full-bleed, pannable/zoomable **infinite canvas** for a single project
  (`/projects/:id`): drag-to-pan, ctrl/⌘+wheel (and trackpad pinch) zoom-to-cursor,
  two-finger/wheel pan, a camera-tracking background grid, and a floating HUD
  (zoom %, +/−, "Reset view").
- The **camera/viewport model** (`camera = {center,zoom}`, zoom clamped 0.1–6.0) as
  a Zustand store, with pure screen↔world coordinate transforms.
- The **uniform-grid spatial index** (`SpatialGrid`) as a standalone, fully
  unit-tested DSA module — the scaffolding for Phase 4 culling/hit-testing.
  **No cards yet**; the grid is exercised only by a dev-only debug overlay.
- The project name loads via `GET /api/projects/:id`, reusing the Phase 2
  owner-scoped 404 so a non-owned/nonexistent id renders a "not found" state.
- **Vitest** introduced as the client test runner (25 unit tests) and wired into CI.

### How it was done

- **Pure logic isolated from React** (`client/src/canvas/`): `coordinates.ts`
  (transforms, `zoomToCursor`, `clampZoom`) and `SpatialGrid.ts` (`Map<"col|row",
Set<CardId>>` + a bbox-per-id map for O(1) remove and precise queries). Both are
  DOM-free and unit-tested to the DSA contract (build O(n); insert/remove/update/move
  O(1) avg; search O(cells+hits); hitTest O(cell_occupancy)).
- **State in Zustand, not React** (`store/viewportStore.ts`): pan/zoom fire at
  pointer/wheel rate, so only the layers that subscribe (WorldLayer, BackgroundGrid)
  re-render — never the page. The store lives outside the tree, surviving StrictMode's
  dev double-mount. Every action clamps zoom and drops non-finite results.
- **Rendering** = one CSS-`transform`ed world layer (`transform-origin: 0 0`) over a
  gradient background grid whose `backgroundSize`/`backgroundPosition` track the camera
  (crisp 1px lines at any zoom). DOM only, per ADR D8.
- **Input** (`hooks/usePanZoom.ts`): pointer capture for drag-pan; a **native** wheel
  listener with `{ passive:false }` so it can `preventDefault()` (React's synthetic
  `onWheel` is passive). Listeners are added/removed in one effect (StrictMode-safe),
  and a press that starts on a HUD control never begins a pan.
- **Cell size = 512** world px (project's documented tuning target; resolves the ADR's
  512-vs-3000 note). **z-order** representation deferred to Phase 4 (Card model).
- **Dev-only validation:** a debug overlay (toggle in the HUD) draws the spatial cells
  and 8 non-persisted demo markers in world space and reports a live "N / M markers in
  view" via `SpatialGrid.search`. Gated on `import.meta.env.DEV` referenced directly at
  each JSX site, and the demo grid is built lazily (no module-level side effect) — so
  the overlay, its data, and `SpatialGrid` are **fully tree-shaken from prod** (verified:
  0 debug bytes in the production bundle; bundle shrank ~1.9 kB).

### What changed

- **New dependency (exact-pinned):** `vitest@4.1.10` (dev; MIT, native Vite
  integration, peer `vite ^6||^7||^8` — satisfies our Vite 8.1.5). Adds no new
  high/critical advisory; `audit-ci` stays green. Tests run in `environment: 'node'`
  (no jsdom/happy-dom dependency).
- **New scripts (client):** `test` (`vitest run`), `test:watch`; new `vitest.config.ts`.
- **New files:** `client/src/canvas/*` (constants, types, coordinates(+test),
  SpatialGrid(+test), WorldLayer, BackgroundGrid, CanvasHud, WhiteboardCanvas, DebugLayer,
  DebugCount, debugData), `client/src/store/viewportStore.ts(+test)`,
  `client/src/hooks/usePanZoom.ts`.
- **Edited:** `api/projects.ts` (+`get`), `hooks/useProjects.ts` (+`useProject`),
  `pages/WhiteboardPage.tsx` (rewrite: load/404/error → canvas), `index.css`
  (`.whiteboard*` block), `tsconfig.node.json` (+`vitest.config.ts`),
  `.github/workflows/ci.yml` (+`npm test --workspace client`).
- **Breaking:** none. No schema, migration, or server route changes.

### Security notes (Phase 3 scope)

- **A01 / CWE-639 (IDOR):** the whiteboard route loads via the owner-scoped
  `GET /projects/:id`; non-owned/nonexistent (404) and non-UUID (400) both render the
  same "not found" — no existence leak. `encodeURIComponent(id)` hardens the path.
- **A03 / CWE-79 (XSS):** the project name renders via React escaping only; no
  `dangerouslySetInnerHTML`.
- **CWE-1284 / CWE-400 (robustness/DoS):** `Number.isFinite` guards + `clampZoom` stop a
  bad wheel/pointer delta from freezing the layout with a `NaN`/`Infinity` transform;
  handlers mutate only numeric camera state and `preventDefault` the wheel so it cannot
  hijack page scroll/navigation.
- **A06 (components):** `vitest` exact-pinned; `audit-ci` gate unchanged (waivers as Phase 2).

### Verification (Phase 3)

| Check                          | Result                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| format / lint / typecheck      | ✅ all pass (server + client)                                 |
| build (client)                 | ✅ `tsc -b && vite build`                                     |
| Client unit tests (Vitest)     | ✅ **25/25** (coordinates 7, SpatialGrid 10, viewportStore 8) |
| Cumulative unit / e2e          | ✅ **40 unit** (15 server + 25 client) / 12 e2e unchanged     |
| Debug overlay excluded in prod | ✅ 0 debug bytes in the built bundle (tree-shaken)            |
| `audit-ci` gate                | ✅ no un-allowlisted high/critical                            |
| 500-line/file cap              | ✅ largest new file 140 lines                                 |

### Residual risks / follow-ups

- Multi-touch **pinch** works via ctrl+wheel (browsers deliver trackpad pinch that way);
  there is no dedicated touch-pinch gesture handler yet.
- The debug overlay is dev-only and verified absent from prod; demo markers are
  non-persisted throwaway data for validating the transforms/index.
- The `SpatialGrid` is scaffolding — nothing populates it in the app until Phase 4 wires
  cards in (and resolves `zIndex` vs. fractional-index for z-order).
- react-router RSC / brace-expansion / valibot waivers unchanged (still allowlisted).

### Phase gate

Phase 3 is complete. **Awaiting explicit approval to begin Phase 4** (card CRUD +
per-card IDOR, wiring cards into the spatial index, and card content rendering with XSS
sanitization — the z-order representation is decided there).

---

## Phase 4 — Cards: CRUD, Spatial-Index Wiring & Plain-Text Content — 2026-07-25

### What was done

- **Cards** — freely positioned, draggable, editable plain-text notes on a project's
  whiteboard. Create by **double-clicking** empty canvas (card appears under the cursor)
  or via the HUD **"+ Card"**; drag to move; double-click to edit; hover for a delete (×);
  press to bring to front.
- **Nested REST resource** `/api/projects/:projectId/cards` (full CRUD) with **per-user
  AND per-project** authorization.
- **Cards wired into the Phase 3 `SpatialGrid`**, which now does real work: viewport
  **culling** — only cards intersecting the padded viewport (plus the one being dragged)
  are mounted.
- **Decisions settled** (deferred by the ADR to this phase): z-order = **integer
  `zIndex`** (server assigns max+1); content = **plain text** (React-escaped).

### How it was done

- **Backend mirrors the Projects module.** `CardsService` injects only `PrismaService`;
  every single-card query filters `{ id, projectId, project: { ownerId } }`, so a card that
  isn't the caller's — or isn't in the URL's project — returns **404** (never 403). `create`
  and `list` gate on `assertProjectOwned`. `create` computes `zIndex = (max ?? -1) + 1`;
  `zIndex` is not accepted from the body (can't be spoofed). Controller mirrors Projects
  (class `SessionAuthGuard`, `ParseUUIDPipe` on both params, POST 201 / DELETE 204).
- **DTOs** are hand-written mirrors (not `PartialType`) with shared bounds
  (`card-bounds.ts`): coords `±1e6`, size `[40, 10_000]`, content `≤ 10_000`, `zIndex`
  `≤ 2_147_483_647`, `@IsNumber({allowNaN:false, allowInfinity:false})`.
- **Frontend** extends the Phase 3 canvas with no new dependencies. `useCards` holds the
  server list; `useUpdateCard`/`useDeleteCard` are **optimistic** (ADR D10): `onMutate`
  applies the change synchronously (so a drag-end commit batches with clearing the drag
  offset — no flicker), rolls back on error, reconciles on settle. Content edits debounce
  via a hand-rolled `useDebouncedCallback` (400 ms; flush on blur/unmount). Card drag uses
  the existing `[data-no-pan]` hook + card-owned pointer capture, so it never pans the
  canvas. `CardsLayer` keeps a `SpatialGrid` in sync (`useMemo` rebuild on the card list)
  and culls with `grid.search(paddedViewportRect)`; `CardView` (`React.memo`) is thin
  presentation + local interaction. Pure geometry (`cardGeometry.ts`) is unit-tested.
- **Rendering** stays DOM-only: cards are absolutely-positioned world-space children of the
  one CSS-transformed `WorldLayer`, so pan/zoom needs no per-card math.

### What changed

- **No new dependencies.** Plain-text + React escaping replaces any sanitizer; the debounce
  is hand-rolled. `audit-ci` stays green.
- **Schema/migration:** `Card` model (`x,y,w,h` floats, `content`, `zIndex`, cascade from
  Project) + `cards Card[]` on `Project`; migration `20260725062045_add_cards`.
- **New files:** `server/src/cards/*` (controller, service, module, dto/{create,update,bounds},
  service.spec) + `server/test/cards.e2e-spec.ts`; `client/src/api/cards.ts`,
  `client/src/hooks/{useCards,useDebouncedCallback}.ts`,
  `client/src/canvas/{cardGeometry(+test),CardsLayer,CardView}.tsx`.
- **Edited:** `client/src/canvas/{WhiteboardCanvas,CanvasHud,constants}.ts(x)`,
  `pages/WhiteboardPage.tsx` (threads `projectId`), `index.css` (card styles),
  `api/types.ts` (`Card`), `server/src/app.module.ts` (register `CardsModule`).
- **Breaking:** none.

### Security notes (Phase 4 scope)

- **A01 / CWE-639 (IDOR, per-user + per-project):** single relation-filtered query →
  404; proven by e2e **two-user** and **two-project** 404 matrices.
- **A03 / CWE-79 (XSS):** card content is plain text via React escaping (`pre-wrap`); no
  `dangerouslySetInnerHTML`, no sanitizer — the Phase-0-deferred item, satisfied by
  construction.
- **CWE-20 / CWE-400 (validation / DoS):** finite + `@Min/@Max` bounds on coords/size,
  `@MaxLength` on content, `@Max` on zIndex; `whitelist`/`forbidNonWhitelisted` strip
  unknown fields; client camera reads are finite-guarded.
- **CWE-352 CSRF** automatic (double-submit + retry); **A03/CWE-89** all Prisma.

### Verification (Phase 4)

| Check                     | Result                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| `prisma migrate dev`      | ✅ `add_cards` applied                                           |
| format / lint / typecheck | ✅ all pass (server + client)                                    |
| build (server + client)   | ✅                                                               |
| Unit tests                | ✅ **server 22** (+7 cards) · **client 32** (+7 cardGeometry)    |
| e2e tests (vs Postgres)   | ✅ **17** (+5 cards: CRUD, two-user IDOR, two-project IDOR, 400) |
| `audit-ci` gate           | ✅ no un-allowlisted high/critical — **no new dependencies**     |
| 500-line/file cap         | ✅ largest new source file 160 lines                             |

### Residual risks / follow-ups

- ~~**Bring-to-front `zIndex` is client-computed** (max+1) — a future server-side endpoint
  removes a concurrent-tab race.~~ **Resolved in Phase 6** (server-allocated `bring-to-front`;
  client `zIndex` no longer accepted).
- No card **resize** yet (fixed default size, draggable + editable); resize handles are a
  later polish.
- Markdown/rich content deferred (plain text for now); would add a sanitizer when it lands.
- react-router RSC / brace-expansion / valibot waivers unchanged (still allowlisted).

### Phase gate

Phase 4 is complete. **Awaiting explicit approval to begin Phase 5** (hardening: security
headers/CSP review, error/observability polish, performance passes, and any deferred
follow-ups above).

---

## Phase 5a — Rich Cards: Color, Shapes, Rotation, Resize & Selection — 2026-07-26

> Note: at the user's direction, Phase 5 became a feature expansion (rich cards + relation
> arrows) rather than the hardening pass the Phase 4 gate anticipated. This is **Phase 5a**
> (rich cards); **Phase 5b** (relation arrows) follows. Hardening moves to a later phase.

### What was done

- Cards are now **rich nodes**: per-card **fill colour** (8-swatch palette **+** a native
  custom colour picker; new cards cycle the palette so a board isn't all one colour, and body
  text auto-contrasts by luminance), **five shapes** (card/rounded-rect, rectangle,
  ellipse/circle, diamond, triangle — all text-capable), free **rotation** (drag handle;
  Shift-snaps to 15°), and **resize** via 8 handles that respect rotation.
- A **selection** model: click a card to select it (shows an outline, resize/rotate handles, and
  a fixed top-centre **toolbar** for colour/shape/delete); click empty canvas or press Escape to
  deselect.

### How it was done

- **Backend** extends the existing `Card`: `shape String @default("card")`, `color String
@default("#ffffff")`, `rotation Float @default(0)` (migration `20260726033408_add_card_style`,
  additive + backfilled). Validated server-side — `shape @IsIn(SHAPES)`, `color @Matches(/^#[0-9a-fA-F]{6}$/)`,
  `rotation` finite + `@Min(-360)/@Max(360)` — in both mirror DTOs, with the limits centralised in
  `dto/card-bounds.ts`. The service passes the fields through (Prisma applies defaults when absent);
  no controller/route change.
- **Rotation-aware resize is pure + unit-tested** (`canvas/cardResize.ts`): `resizeCard` keeps the
  corner/edge OPPOSITE the dragged handle pinned in world space by working in the card's local
  (unrotated) frame; `rotateCard` maps a pointer angle to degrees (Shift-snap). Tests assert the
  anchor-fixed invariant at 0° AND 90°, plus min/max clamp and the rotate angle/snap math.
- **CardView restructured** into an un-clipped rotated wrapper (position/rotation/handlers) holding
  a clipped shape body (fill + auto-contrast text) + the delete button + (when selected) the
  handles — so `clip-path`/`overflow:hidden` never clips the chrome. Drag/resize/rotate each feed a
  single transient `preview` and commit **one optimistic PATCH on release** (ADR D10); the
  optimistic update is applied synchronously so the commit batches with clearing the preview (no
  flicker). Interaction split into `hooks/useCardDrag` + `hooks/useCardResize` + `canvas/CardHandles`.
- **Selection** is a small Zustand store (`store/selectionStore.ts`) — narrow subscription means only
  the two cards whose selected-ness flips re-render. The toolbar reads the live card from the React
  Query cache, so it survives culling and reflects optimistic edits instantly. Handles/toolbar carry
  `data-no-pan`, so the canvas never pans during a card gesture; the selected card is always kept in
  the culling set so its handles never vanish at a viewport edge.

### What changed

- **No new dependencies** (native `<input type="color">` + CSS `clip-path`/`border-radius`).
  `audit-ci` stays green.
- **Schema/migration:** `Card` += `shape/color/rotation`; migration `add_card_style`.
- **New files:** `client/src/canvas/{cardShapes(+test),cardResize(+test),CardHandles,SelectionToolbar}.ts(x)`,
  `client/src/hooks/{useCardDrag,useCardResize}.ts`, `client/src/store/selectionStore.ts`.
- **Edited:** `CardView`/`CardsLayer`/`WhiteboardCanvas`/`constants`/`index.css`; `api/types.ts` +
  `api/cards.ts` (three fields); the two backend DTOs + `card-bounds.ts` + `cards.service.ts` + the
  two card test files.
- **Breaking:** none.

### Security notes (Phase 5a scope)

- **CWE-20 (input validation):** `color` (hex `@Matches`), `shape` (`@IsIn` allowlist), `rotation`
  (finite + bounded) validated server-side; `whitelist`/`forbidNonWhitelisted` strip unknown props.
  `color` is only ever a CSS value and `shape` a fixed class-name lookup — **no injection surface**.
- **A03 / CWE-79:** content stays plain text via React escaping; no `dangerouslySetInnerHTML`.
- **A01 IDOR** unchanged (`{ id, projectId, project:{ ownerId } }`); no new routes. No new deps.

### Verification (Phase 5a)

| Check                     | Result                                                          |
| ------------------------- | --------------------------------------------------------------- |
| `prisma migrate dev`      | ✅ `add_card_style` applied + backfilled                        |
| format / lint / typecheck | ✅ all pass (server + client)                                   |
| build (server + client)   | ✅                                                              |
| Unit tests                | ✅ **server 23** (+1 cards) · **client 43** (+11 resize/shapes) |
| e2e tests (vs Postgres)   | ✅ **18** (+1 card-style persistence; +4 style validation 400s) |
| `audit-ci` gate           | ✅ no un-allowlisted high/critical — **no new dependencies**    |
| 500-line/file cap         | ✅ all source files well under (largest CardView 127)           |

### Residual risks / follow-ups

- ~~Resize/rotate handles **scale with zoom**; follow-up: a `--inv-zoom` CSS var to pin them to
  constant screen size.~~ **Resolved in Phase 6** (`--inv-zoom` counter-scales handles + ports). CSS
  resize cursors don't track arbitrary rotation (acceptable).
- Culling uses each card's axis-aligned `x,y,w,h` (rotation ignored); the padded viewport
  over-includes, so a rotated corner is never dropped early.
- `client/src/index.css` is at ~486 lines (approaching the 500 cap) — split into per-area sheets in
  Phase 5b.
- Bring-to-front `zIndex` race (**resolved in Phase 6**), no markdown, prior waivers — from Phase 4.

### Follow-up — per-card text size (2026-07-26)

- Added a **`fontSize Int @default(14)`** field to `Card` (migration `20260726034849_add_card_font_size`,
  additive + backfilled), validated `@IsInt @Min(8) @Max(96)` in both DTOs (bounds in `card-bounds.ts`);
  the service passes it through. Applied inline on the card body (`.whiteboard__card-content`/`-textarea`
  switched to `font-size: inherit` so it cascades), controlled by an **A− / value / A+** stepper in the
  selection toolbar (steps 2 px, clamped by a pure, unit-tested `clampFontSize`). No new deps; `fontSize`
  is only ever a CSS value (no injection surface). Tests: +1 client unit (44 total); server unit 23 and
  e2e 18 unchanged in count (fontSize folded into the existing style-persistence + validation cases).

### Phase gate

Phase 5a is complete. **Awaiting explicit approval to begin Phase 5b** (relation arrows: a
`Connection` entity + live-tracking straight-line SVG connectors between cards, mirroring the cards
module for per-user/per-project IDOR).

---

## Phase 5b — Relation Arrows (card-to-card connections) — 2026-07-26

### What was done

- Cards can now be **connected by a directed arrow**. Select a card → four **connect ports** appear
  on its edges; **drag from a port onto another card** to link them (a rubber-band arrow follows the
  cursor and drops to create the connection).
- Arrows **re-anchor live**: dragging, resizing, or rotating either endpoint card moves the arrow
  with it in real time — not just on gesture-end. Endpoints are trimmed to each card's border so the
  arrowhead touches the edge.
- **Recolour + delete:** click an arrow to select it (highlighted); a top-centre toolbar recolours it
  (palette + custom picker) or deletes it. Deleting a card removes its arrows (DB cascade), and the
  UI reflects it immediately.

### How it was done

- **Backend** mirrors the cards module: a new `Connection` model (`projectId`, `sourceCardId`,
  `targetCardId`, `color`; migration `20260726044646_add_connections`) with **three `onDelete:
Cascade` FKs** (project + both endpoint cards → no orphans) and a `@@unique([sourceCardId,
targetCardId])` (one arrow per ordered pair; A→B ≠ B→A). New `src/connections/` module
  (controller/service/DTOs) under `/api/projects/:projectId/connections`, registered after
  `CardsModule`. The service reuses the exact per-user + per-project IDOR filter
  (`{ id, projectId, project:{ ownerId } }` → 404); `create` verifies **both** endpoint cards live in
  the same owned project, rejects self-links (400), and maps the unique violation to 409.
- **Live tracking** is the one net-new architectural piece: a small Zustand `liveRectStore` keyed by
  card id. `CardView`'s drag/resize/rotate preview now also writes/clears this store (additive — the
  card's own paint and the tested commit flow are unchanged), so `ConnectionsLayer` can read a card's
  in-gesture geometry. Committed positions still come from the React Query cache.
- **Rendering** is a non-transformed, full-viewport SVG sibling of the world layer (like
  `BackgroundGrid`): each endpoint is converted world→screen, giving constant stroke width and
  reliable hit-testing on the otherwise-thin lines (a 0×0 in-world SVG makes clicks flaky). Border
  trimming + the arrowhead polygon are pure and unit-tested (`canvas/connectionGeometry.ts`).
- **Creation** uses a `connectionDraftStore` + `useConnectionDraft` (window-listener gesture, same
  technique as `useCardResize`): a port's pointer-down starts a draft; on release the drop target is
  resolved via `elementFromPoint` + a `data-card-id` on each card, then the connection is created
  (server remains the authority — self→400, duplicate→409).
- **Selection** was unified: `selectionStore` now holds either a `selectedId` (card) or a
  `selectedConnectionId` (arrow), mutually exclusive.

### What changed

- **No new dependencies** (native SVG). `audit-ci` stays green.
- **Schema/migration:** new `Connection` model + `add_connections` migration; back-relations on
  `Card`/`Project`.
- **`index.css` split** to honour the 500-line cap (it had reached 565): rules moved into
  `styles/base.css` + `canvas/{whiteboard,cards,connections}.css`, aggregated by an `@import`
  manifest in `index.css` (cascade order preserved).
- **New files:** `server/src/connections/**` (module/controller/service/DTOs + spec) and
  `test/connections.e2e-spec.ts`; `client/src/api/connections.ts`, `hooks/{useConnections,
useConnectionDraft}.ts`, `store/{liveRectStore(+test),connectionDraftStore}.ts`,
  `canvas/{ConnectionsLayer,ConnectionToolbar,connectionGeometry(+test)}.tsx?`, the four CSS partials.
- **Edited:** `CardView`/`CardHandles`/`WhiteboardCanvas`/`constants`/`selectionStore`/`useCards`
  (cascade invalidation); `api/types.ts`.
- **Breaking:** none.

### Security notes (Phase 5b scope)

- **A01 IDOR / CWE-639:** connection routes are session-guarded and relation-filtered
  (`{ id, projectId, project:{ ownerId } }` → 404, never 403). `create` additionally checks **both**
  endpoint cards belong to the caller's project — no cross-project or cross-user linking.
- **Integrity:** cascade FKs guarantee no orphan arrows; the client invalidates the connections query
  after a card delete.
- **CWE-20 (input validation):** endpoint ids `@IsUUID`, `color @Matches(/^#[0-9a-fA-F]{6}$/)`;
  `whitelist`/`forbidNonWhitelisted` strip unknowns; self-link → 400, duplicate → 409. `color` is only
  ever an SVG `stroke` value — no injection surface.

### Verification (Phase 5b)

| Check                     | Result                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| `prisma migrate dev`      | ✅ `add_connections` applied (3 cascade FKs + unique pair)         |
| format / lint / typecheck | ✅ all pass (server + client)                                      |
| build (server + client)   | ✅                                                                 |
| Unit tests                | ✅ **server 33** (+10 connections) · **client 55** (+11 geo/store) |
| e2e tests (vs Postgres)   | ✅ **25** (+7: CRUD, IDOR, cross-project, self/dup, cascade, 400)  |
| `audit-ci` gate           | ✅ no un-allowlisted high/critical — **no new dependencies**       |
| 500-line/file cap         | ✅ all source files well under; `index.css` split (largest 272)    |

### Residual risks / follow-ups

- Arrows are straight lines between AABB borders (rotation ignored for the anchor box, matching
  `cardBounds`); curved/orthogonal routing and multi-select are future work.
- Connect ports and the arrow layer are pointer-only (no keyboard path) — consistent with the current
  canvas a11y posture; a keyboard/AT story for the whole board remains a later pass.
- The live-rect mirror keeps two sources of truth during a gesture (local `preview` + `liveRectStore`)
  by design, to leave the tested drag/commit flow untouched; unifying them is a clean follow-up.

### Phase gate

Phase 5b is complete. **Awaiting explicit approval to begin the next phase** (candidates: the deferred
hardening pass — bring-to-front `zIndex` race, handle/port constant-screen-size via `--inv-zoom`,
markdown/rich content — or another feature the user prioritises).

---

## Phase 6 — Hardening & Polish — 2026-07-26

### What was done

- **Bring-to-front is now server-authoritative** — no more cross-tab race where two clients both
  wrote `max+1` and tied. Stacking order (`zIndex`) can no longer be set by the client at all.
- **Selection handles + connect ports stay a constant on-screen size and distance at every zoom**
  (they used to grow with the world `scale(zoom)`).
- **Keyboard shortcuts:** Escape (clear / cancel arrow-drag), Delete/Backspace (remove the selected
  card or arrow), and Arrow keys to nudge the selected card (Shift = ×10) — all inert while typing in
  a card.
- **A light performance pass** that stops needless re-renders during drags, plus a DEV-only FPS meter.

### How it was done

- **`zIndex` race → server endpoint.** New `POST /projects/:projectId/cards/:id/bring-to-front`
  (`cards.controller`/`cards.service`) allocates `max+1` inside a `prisma.$transaction`, recomputed
  from committed DB state (reuses the `create` pattern); `getOwned` still 404-guards it. **`zIndex`
  removed from `UpdateCardDto`**, so a PATCH carrying it now 400s (`forbidNonWhitelisted`). Client
  side: `useBringToFront` (optimistic `nextZIndex` for instant feel, reconciled on settle);
  `CardsLayer.onBringToFront` reads the cache via `queryClient` (not a `cards` closure) — which also
  **stabilises its identity**, so memoized `CardView`s stop re-rendering on unrelated mutations.
- **Constant-screen chrome.** `WorldLayer` publishes `--inv-zoom` (= 1 / zoom) as a CSS custom
  property; `cards.css`/`connections.css` counter-scale the resize/rotate handles, selection outline,
  and connect ports with `scale(var(--inv-zoom))` + `calc(… * var(--inv-zoom))` offsets. The
  rotate-gesture world anchor is divided by zoom to match (`useCardResize.beginRotate`).
- **Keyboard.** Extracted `hooks/useCanvasKeyboard` (mounted once in `WhiteboardCanvas`): reads
  selection/stores via `.getState()`, guards on `document.activeElement` being a text field. Nudge is
  optimistic-immediately + debounced-commit (ADR D10) via a pure, unit-tested `nudgeDelta`.
- **Perf.** Each arrow is now a memoized `ConnectionArrow` subscribing to only its two endpoints'
  live rects (`useLiveRect`), so dragging an **unconnected** card re-renders no arrows (the layer no
  longer subscribes to the whole live-rect map). `CardsLayer.visible` is memoized. DEV FPS meter
  (`useFrameStats` + `DebugFps`) rides the existing DEV-gated debug slot (tree-shaken from prod).

### What changed

- **No new dependencies.** No schema/migration change (bring-to-front reuses `zIndex`).
- **New files:** `client/src/canvas/{ConnectionArrow.tsx,nudge.ts,nudge.test.ts,DebugFps.tsx}`,
  `client/src/hooks/{useCanvasKeyboard,useFrameStats}.ts`.
- **Edited (server):** `cards.controller` (+route), `cards.service` (+`bringToFront`),
  `dto/update-card.dto` (−`zIndex`), `cards.service.spec` + `cards.e2e-spec` (+tests).
- **Edited (client):** `api/cards` (+`bringToFront`, −`zIndex`), `hooks/useCards`
  (+`useBringToFront`, export `cardsKey`), `CardsLayer`, `WorldLayer`, `ConnectionsLayer`,
  `useCardResize`, `constants`, `cards.css`, `connections.css`, `store/liveRectStore` (+`useLiveRect`),
  `WhiteboardCanvas`.
- **Breaking:** clients may no longer send `zIndex` in a card PATCH (now 400) — internal only; the app
  uses the new endpoint.

### Security notes (Phase 6 scope)

- **CWE-472 (parameter tampering):** stacking order is server-owned; a client `zIndex` is rejected.
- **A01 / CWE-639 IDOR:** the new route reuses the relation-filtered `getOwned` (404); no new trust
  surface. Keyboard deletes/nudges reuse existing owner-scoped, validated endpoints; the editing guard
  prevents key hijacking of text input.
- **No new dependencies** → `audit-ci` stays green.

### Verification (Phase 6)

| Check                     | Result                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| format / lint / typecheck | ✅ all pass (server + client)                                     |
| build (server + client)   | ✅ (DEV FPS meter + debug tooling tree-shaken from prod)          |
| Unit tests                | ✅ **server 35** (+2 bringToFront) · **client 58** (+3 nudge)     |
| e2e tests (vs Postgres)   | ✅ **26** (+1: bring-to-front raises; PATCH `zIndex` → 400; IDOR) |
| `audit-ci` gate           | ✅ no un-allowlisted high/critical — **no new dependencies**      |
| 500-line/file cap         | ✅ all source files well under (largest touched 288)              |

### Residual risks / follow-ups

- Bring-to-front recomputes `max+1` from committed state, which fixes the reported stale-cache race;
  two _truly simultaneous_ requests could still tie (narrow window). A per-project sequence or advisory
  lock is the future fix if concurrent editing lands.
- The live-rect mirror still keeps two sources of truth during a gesture (local `preview` +
  `liveRectStore`) by design; unifying them remains a clean follow-up.
- `SpatialGrid` still fully rebuilds on any `cards` change (O(n), only on commits) — acceptable;
  incremental update is a later option.
- Markdown/rich text (**resolved in Phase 7**); still no multi-select (Ctrl+A intentionally deferred
  to that phase).

### Phase gate

Phase 6 is complete. **Awaiting explicit approval to begin the next phase.** Roadmap: **Phase 7** —
Rich text / markdown in cards (sanitized); **Phase 8** — Multi-select + grouping + undo/redo;
**Phase 9** — Sharing / export.

---

## Phase 7 — Rich Text (Markdown) in Cards — 2026-07-26

### What was done

- **Card content is now Markdown.** Editing still shows the raw source in the double-click textarea; the
  card **renders** it — headings, bold/italic, lists, links, code, blockquotes, and GFM
  tables/strikethrough/task-lists — when not editing.
- Rendering is **XSS-safe by construction**: it never builds an HTML string and never uses
  `dangerouslySetInnerHTML`.

### How it was done

- New **`CardMarkdown`** component wraps `react-markdown` + `remark-gfm`. It renders Markdown to React
  elements, so: raw HTML in the source is **ignored** (no `rehype-raw` — it's shown as inert escaped
  text), dangerous URL schemes (`javascript:`…) are stripped by react-markdown's default `urlTransform`,
  links open in a new tab with `rel="noopener noreferrer nofollow"`, and **images are dropped** (v1 — no
  external resource loads). `CardView` renders it only in the display branch (the single content→UI path);
  the raw-source textarea + placeholder are unchanged.
- **Lazy-loaded** via `React.lazy` + `Suspense` (fallback = the raw text) so the ~46 kB-gzip
  remark/micromark tree ships as a **separate chunk** loaded on demand — the whiteboard shell chunk stays
  ~355 kB (unchanged from Phase 6). Styling is a `.whiteboard__card-markdown` block in `cards.css`, sized
  in **`em`** so it scales with the card's `fontSize` and fits the fixed-size, `overflow:hidden` card.
- **No server change, no migration** — `content` is still a stored/validated text field; the server emits
  JSON only (CSP `default-src 'none'`), so sanitization is 100% the client renderer's job.

### What changed

- **New dependencies** (exact-pinned, client): `react-markdown` **10.1.0**, `remark-gfm` **4.0.1** — both
  **MIT**, the widely-used/well-audited unified·remark·rehype·micromark stack, **clean advisory record**
  (added **0** new `audit-ci` HIGH/CRITICAL; the two allowlisted advisories are pre-existing).
- **New files:** `client/src/canvas/{CardMarkdown.tsx, CardMarkdown.test.tsx}`; markdown styles in
  `cards.css`; `vitest.config.ts` include broadened to `*.test.{ts,tsx}`.
- **Edited:** `CardView.tsx` (lazy `CardMarkdown` in the display branch + header comment).
- **Bundle:** main chunk **355 kB / 111 kB gzip** (unchanged) + a lazy `CardMarkdown` chunk
  **154 kB / 46 kB gzip**.
- **Backward-compat:** existing plain-text cards now render as Markdown (plain text → a paragraph;
  stray `#`/`*`/`>` may format) — acceptable for the MVP. **Breaking:** none.

### Security notes (Phase 7 scope)

- **A03 / CWE-79 (XSS):** the single render path goes through react-markdown — no `innerHTML`, raw HTML
  ignored (escaped to text), URL schemes sanitized, images off. Covered by node-env tests
  (`renderToStaticMarkup`): `<script>`, `javascript:` links, raw `<img onerror>`, and Markdown images are
  all proven inert/dropped; safe links get `target="_blank"` + `noopener`.
- **Defense in depth:** server still stores content as trimmed text (`@IsString`, `@MaxLength(10_000)`)
  and never renders HTML. No new server surface; IDOR unchanged.

### Verification (Phase 7)

| Check                     | Result                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| format / lint / typecheck | ✅ all pass (server + client)                                    |
| build (server + client)   | ✅ Markdown code-split to a lazy chunk (main chunk unchanged)    |
| Unit tests                | ✅ **client 65** (+7 CardMarkdown security + render) · server 35 |
| e2e tests (vs Postgres)   | ✅ **26** (server unchanged — re-run green)                      |
| `audit-ci` gate           | ✅ **no new HIGH/CRITICAL** from the two new deps                |
| 500-line/file cap         | ✅ all source files well under (`cards.css` 379)                 |

### Residual risks / follow-ups

- **Images are disabled** in v1 (privacy/tracking) — re-enable later with a URL allowlist (+ optional CSP
  `img-src`).
- Content overflowing the fixed card is **clipped** (no scroll), by design — a future "expand/scroll on
  select" affordance is possible.
- Plain-text→Markdown reinterpretation of pre-Phase-7 content (above) is accepted; a `contentFormat` flag
  is the escape hatch if it ever matters.

### Follow-up — card creation is button-only (2026-07-26)

- **Removed double-click-to-add.** A card is now created **only** via the HUD **"+ Card"** button (at the
  viewport centre); double-clicking empty canvas no longer creates one — this prevents accidental cards
  during interaction and makes creation an explicit action. Double-clicking a _card_ still opens Markdown
  editing (that handler lives on the card and stops propagation). Change was `WhiteboardCanvas.tsx` only
  (deleted the `onDoubleClick` handler + prop + now-unused `screenToWorld`/`ReactMouseEvent` imports);
  no new deps, no test change (client 65 unchanged, build/lint/typecheck green).

### Phase gate

Phase 7 is complete. **Awaiting explicit approval to begin the next phase.** Roadmap: **Phase 8** —
Multi-select + grouping + undo/redo; **Phase 9** — Sharing / export.

---

## Phase 8 — Multi-select, Grouping & Undo/Redo — 2026-07-27

### What was done

- **Multi-select:** left-drag on empty canvas draws a **rubber-band marquee** (live-selects intersecting
  cards; Shift = additive); **Shift-click** toggles a card; **Ctrl/⌘-A** selects all. Panning moved to
  **middle-drag** and **Space + left-drag** (wheel/two-finger unchanged). _(Superseded 2026-07-28 by
  the Select / Hand tool switch — see the Phase 9 follow-up.)_
- **Group operations:** dragging any selected card moves the **whole selection** (arrows follow live); the
  toolbar recolours / reshapes / resizes-text / **deletes** the whole selection at once (with an
  all-share-or-mixed highlight + an "N selected" count); Delete and arrow-nudge act on the group.
- **Full undo/redo** (Ctrl/⌘-Z, Ctrl/⌘-Y or ⌘-⇧-Z) — including **undo of a delete**, which brings the card
  back with its **same id, stacking (`zIndex`), and arrows**.

### How it was done

- **Backend soft-delete (the enabler for undo-delete):** `Card`/`Connection` gained `deletedAt`
  (migration `add_soft_delete`); `remove` now sets it and all reads filter it out; arrows to a
  soft-deleted card auto-hide (connection list filter) and reappear on restore; connection `create`
  **restores** a soft-deleted `(source,target)` pair instead of colliding (keeps the id, respects the
  unique index). New **transactional batch routes** — `PATCH /cards` (bulk update), `POST
/cards/bulk-delete` + `/bulk-restore` (and connection bulk delete/restore) — each verifies **every** id
  is owner-scoped (404) before mutating; new nested-array DTOs (`@ValidateNested`/`@ArrayMaxSize`).
- **Client:** `selectionStore` became a `Set<string>` of card ids (+ `toggle`/`selectMany`/`addMany`);
  `useMarquee` (native container listeners, mutually excluded from pan by button/Space) hit-tests a pure,
  unit-tested `cardsInRect`; group-drag broadcasts one world delta to every selected card through
  `liveRectStore` (each `CardView` reads `useLiveRect`) and commits one bulk update. **Undo/redo** is a
  session-scoped `historyStore` of inverse-op closures: `useCardHistory`/`useConnectionHistory` capture
  before/after (or the id, for create/delete) at each action site and push `{undo, redo}` that call the
  bulk mutation hooks directly. New optimistic bulk hooks mirror the existing ADR-D10 pattern.
- **Excluded from undo** (documented): bring-to-front (fires on every card press) and content edits (the
  textarea has its own undo).

### What changed

- **No new dependencies.** Migration `add_soft_delete` (`deletedAt` on both tables).
- **New files:** server `cards/dto/bulk-cards.dto.ts`, `connections/dto/bulk-connections.dto.ts`; client
  `store/{marqueeStore,panModeStore,historyStore}.ts`, `hooks/{useMarquee,useCardHistory,
useConnectionHistory}.ts`, `canvas/{MarqueeOverlay.tsx,cardsInRect(+test),cardHistory}.ts`.
- **Edited:** cards/connections service+controller (soft-delete + bulk); client `selectionStore`,
  `useCardDrag` (group-drag), `CardView`, `CardsLayer`, `SelectionToolbar`, `ConnectionToolbar`,
  `useConnectionDraft`, `usePanZoom` (pan gate), `useCanvasKeyboard`, `WhiteboardCanvas`, api + `useCards`/
  `useConnections` (bulk methods/hooks), CSS (marquee + count).
- **Breaking:** `DELETE /cards|connections/:id` is now a soft delete (same 204). Internal only.

### Security notes (Phase 8 scope)

- **A01/CWE-639 IDOR:** every batch/restore route is session-guarded and verifies **each** id is the
  caller's within the project (relation-filtered → 404) inside a `$transaction`; restore is owner-scoped.
- **CWE-20/400:** nested-array DTOs bounded (`@ArrayMaxSize(500)`) + `@IsUUID`/`@ValidateNested`;
  `forbidNonWhitelisted` still strips unknowns. Soft-deleted rows are invisible to all reads.
- **No new deps** → `audit-ci` green.

### Verification (Phase 8)

| Check                     | Result                                                                         |
| ------------------------- | ------------------------------------------------------------------------------ |
| format / lint / typecheck | ✅ all pass (server + client)                                                  |
| build (server + client)   | ✅                                                                             |
| Unit tests                | ✅ **server 44** (+9 soft-delete/bulk) · **client 69** (+4 marquee)            |
| e2e tests (vs Postgres)   | ✅ **30** (+4: soft-delete/restore round-trip, bulk, connection restore, IDOR) |
| `audit-ci` gate           | ✅ no un-allowlisted high/critical — **no new dependencies**                   |
| 500-line/file cap         | ✅ all source files well under (largest touched 392)                           |

### Residual risks / follow-ups

- **Soft-deleted rows accumulate** (no GC) — acceptable for the MVP; a purge job for rows deleted > N days
  is a clean follow-up.
- Undo/redo is **session-scoped** (not persisted across reloads) and excludes bring-to-front + content
  edits (by design).
- Marquee uses **intersect** (touch-to-select) over card AABBs (rotation ignored, matching culling).
- Group **resize/rotate** act on the single grabbed card (only **move** is grouped) — a future
  bounding-box group transform is possible.

### Phase gate

Phase 8 is complete. **Awaiting explicit approval to begin the next phase** (**Phase 9** — Sharing /
export).

---

## Phase 9 — Sharing & Export (JSON export/import + read-only share links) — 2026-07-28

### What was done

- **Export** a project to a self-contained JSON file (per-project **Export** button → download).
- **Import** a JSON file as a brand-new project (top-level **Import** button → opens the new board).
- **Read-only public share links:** a per-project **Share** control mints a `/share/:token` URL that
  renders the board with **all editing disabled**, viewable by **anyone with the link, without logging
  in**. Links are **live + revocable** (always reflect the current board; owner can turn off any time;
  no expiry, no snapshot).

### How it was done

- **Backend — export/import** (`projects` module, new `ProjectTransferService`/`Controller`): the
  transfer format is **id-free and versioned** — cards carry a local `ref`, arrows point at
  `sourceRef`/`targetRef`. `GET /projects/:id/export` reuses the owner-scoped `getOwned` (404) + the
  live-row read filters. `POST /projects/import` is one `$transaction` that mints fresh card ids,
  remaps refs, sets `zIndex` from array order (preserves stacking), and drops self-loops / dangling
  refs / duplicate pairs (honours `@@unique`). Nested-array DTO (`@ValidateNested`/`@ArrayMaxSize`)
  reuses the Phase 8 pattern.
- **Backend — share** (new `share` module, migration `add_share_links`): a `ShareLink` model
  (`tokenHash @unique`, `revokedAt?`) mirroring the `Session` show-once/hashed-token convention — the
  256-bit token is returned **once** and stored only as `sha256`. Owner routes (guarded) on
  `projects/:projectId/share`: `POST` (revoke-then-create; ≤1 active link), `GET` status, `DELETE`
  revoke. The **one public, unguarded** route `GET /share/:token` (separate controller, no
  `SessionAuthGuard`) resolves an active link and returns only `{ project:{id,name}, cards,
connections }` — 404 for unknown **or** revoked.
- **Client — read-only canvas:** a `readOnly` prop threads through `WhiteboardCanvas` → HUD (hides
  `+Card`), `CardsLayer`/`CardView` (no drag/handles/delete/edit), `ConnectionsLayer` (no
  connect-draft, no arrow-select); `useMarquee`/`useCanvasKeyboard` early-return; **pan/zoom stays
  on**. `useCards`/`useConnections` gained an `enabled` flag so the anonymous view never calls the
  owner-scoped endpoints — `SharedWhiteboardPage` **pre-seeds** those caches from the public payload.
  The `/share/:token` route sits **outside** `ProtectedRoute` (no login redirect). Export downloads a
  Blob (filename via a pure, tested slugifier); import reads the file through a pure, tested
  `parseImportFile` guard before POSTing.

### What changed

- **No new dependencies** (`crypto`/`Blob`/`FileReader` are built-ins). Migration `add_share_links`.
- **New files:** server `projects/{transfer.service,transfer.controller}.ts` +
  `dto/transfer.dto.ts`, `share/{share.service,share.controller,public-share.controller,share.module}.ts`
  (+ specs + `test/{transfer,share}.e2e-spec.ts`); client `api/{transfer,share}.ts`,
  `features/transfer/{parseImportFile,filename,download}.ts` (+ tests), `hooks/{useShare,useTransfer}.ts`,
  `components/ProjectShareControl.tsx`, `pages/SharedWhiteboardPage.tsx`.
- **Edited:** `schema.prisma` (+`ShareLink`, `Project.shareLinks`), `app.module` (+`ShareModule`),
  `projects.module` (+transfer); client `App.tsx` (public route), `ProjectsPage` (export/import/share
  UI), `WhiteboardCanvas`/`CanvasHud`/`CardsLayer`/`CardView`/`ConnectionsLayer`,
  `useMarquee`/`useCanvasKeyboard`/`useConnectionDraft`, `useCards`/`useConnections` (`enabled`),
  `styles/base.css`.

### Security notes (Phase 9 scope)

- **A01/CWE-639 IDOR:** export, import, and all owner share routes are session-guarded and
  owner-scoped (`getOwned`/`assertProjectOwned` → **404**, never 403); import always creates a project
  owned by the caller.
- **Public endpoint (A01/CWE-200/CWE-307):** unauthenticated **by design**, gated by a 256-bit
  unguessable token stored only as `sha256`; identical **404** on unknown/revoked (no existence leak);
  **read-only** (no mutation path); payload carries no owner/user/other-project data; a tighter
  `@Throttle(30/min)` resists enumeration. CSRF: import + share create/revoke require the token
  (existing middleware); the public GET is CSRF-exempt by default (correct).
- **CWE-20/400:** import DTO nested-validated + array sizes bounded (`@ArrayMaxSize`); reused field
  bounds; `forbidNonWhitelisted` strips unknowns; connections validated against `@@unique` + no
  self-loop. Tokens shown once, never stored raw; revoke = `revokedAt` (mirrors sessions).

### Verification (Phase 9)

| Check                     | Result                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| format / lint / typecheck | ✅ all pass (server + client)                                                                 |
| build (server + client)   | ✅ (main client chunk 367 kB / 114 kB gzip)                                                   |
| Unit tests                | ✅ **server 60** (+16 transfer/share) · **client 79** (+10 parse/filename)                    |
| e2e tests (vs Postgres)   | ✅ **40** (+10: export round-trip, import remap/validation, share public-no-auth/revoke/IDOR) |
| `audit` gate              | ✅ no un-allowlisted high/critical — **no new dependencies**                                  |
| 500-line/file cap         | ✅ all source files well under (largest touched 206)                                          |

Manual: export downloads `.json`; import re-creates an identical board (layout/colours/shapes/text/
arrows, stacking preserved); a share link opens read-only in a logged-out browser (pan/zoom only);
revoking makes the link 404. _(Env note: Docker Desktop had stopped mid-run and was restarted before
the e2e pass — not a code issue.)_

### Residual risks / follow-ups

- **No share-link expiry** yet (live + revocable only) — an optional `expiresAt` is a clean follow-up.
- **Import body size** is bounded by DTO array caps but not an explicit Express JSON limit — a
  deliberate `body-parser` limit is a follow-up if very large boards are expected.
- No **"fork this shared board to my account"** action yet (viewer can't copy it in-app).
- Share links **accumulate** revoked rows (no GC), same as soft-deleted rows — a purge job covers both.

### Phase gate

Phase 9 is complete. **Awaiting explicit approval to begin the next phase.**

### Follow-up — canvas tool switch (2026-07-28)

Replaced the implicit left-drag rule with an explicit **Select / Hand** tool switch in the HUD
(icons next to "+ Card"; `V` / `H` keyboard shortcuts). **Select** = the prior interact + marquee
behaviour; **Hand** = left-drag anywhere pans the board, with cards inert while it's active
(Figma/Miro-style). **Removed** the Space-hold and middle-mouse pan gestures (wheel / two-finger
pan + zoom unchanged); the read-only shared view is treated as Hand so left-drag pans there too.
New `store/toolStore.ts` (+ test), `canvas/CanvasToolSwitch.tsx`; `store/panModeStore.ts` removed;
`usePanZoom`/`useMarquee`/`useCanvasKeyboard`/`CardView`/`WhiteboardCanvas`/`CanvasHud` updated.
No new dependencies. Supersedes the Phase 8 "middle-drag / Space + left-drag" pan note above.

### Follow-up — font-size input + arrow labels (2026-07-28)

- **Font size:** the card selection toolbar's read-only value became a **number input** (type a size
  directly, plus the existing `A−`/`A+`); commit clamps to `FONT_SIZE_MIN..MAX` and applies to the
  whole selection as one undoable edit. Uses the render-time reset pattern (no effect) for the draft.
- **Arrow labels:** `Connection` gained `label String @default("")` (migration `add_connection_label`).
  The arrow toolbar has a debounced text input (optimistic, not undoable — like card content), and the
  label renders at the arrow **midpoint** in the screen-space SVG (`<text>`, XSS-safe; white halo,
  constant size at any zoom). `UpdateConnectionDto` validates it (`LABEL_MAX = 200`, trimmed). The
  **transfer format is now versioned-with-label** — export/import round-trip the label (existing shape
  assertions updated). No new dependencies.

### Follow-up — local dev DB moved off Docker (2026-07-28)

Local development now uses a **natively-installed PostgreSQL on port 5432** instead of the Docker
container. Removed `docker-compose.yml` and the container-only env keys (`POSTGRES_DB`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_HOST_PORT`); `.env.example` + README updated (create the DB +
least-privilege role locally, set `DATABASE_URL`, `npm run prisma:deploy`). **No application-code
change** — the datasource already reads `DATABASE_URL` only (`prisma.service.ts` adapter-pg /
`prisma.config.ts`). CI is unaffected: `.github/workflows/ci.yml` uses its own ephemeral Postgres
**service container**, not compose.

### Follow-up — single-image Docker build for the app (2026-07-28)

Added a root **multi-stage `Dockerfile`** (+ `.dockerignore`) that builds client + server and runs
**both from one Node process**: NestJS now serves the built SPA and the API on the same origin (the
`SameSite=Strict` design). Static serving is **opt-in** via a `CLIENT_DIST` env var (set only in the
image), so tests and API-only dev are untouched. New `config/serve-client.ts` (`useStaticAssets` +
an `/api`-safe HTML fallback); `helmetOptions` became `buildHelmetOptions(serveClient)` — the strict
`default-src 'none'` CSP stays for the API, and a self-scoped CSP (scripts `'self'`; `'unsafe-inline'`
**only** for `style-src`, needed by inline card geometry) applies when serving the SPA; `main.ts` binds
`0.0.0.0`. Base image **pinned by digest**, **non-root**, HEALTHCHECK on `/health`, secrets only at run
time (`.env` is dockerignored). DB stays external — the container reaches the host Postgres via
`host.docker.internal:5432`. **No new dependencies.**

### Follow-up — card media: image upload + YouTube/Vimeo embeds + link helpers (2026-07-29)

Each card's Markdown can now hold **uploaded images**, **YouTube/Vimeo video embeds**, and **links**,
added via **Image / Video / Link** buttons in the card editor.

- **Uploads (DBA: metadata-in-DB, bytes-on-disk).** New `Upload` model (migration `add_uploads`) holds
  only `{ ownerId, mimeType, sizeBytes }`; the bytes live under `UPLOAD_DIR` keyed by a random UUID.
  `POST /api/uploads` (session + CSRF, `FileInterceptor`, 5 MB limit, **magic-byte** content sniff —
  raster only, **no SVG**); `GET /api/uploads/:id` is **public** (unguessable id, `StreamableFile`,
  `nosniff`, `ParseUUIDPipe` → no traversal) so images load in read-only share views too.
- **Rendering** reuses the XSS-safe react-markdown pipeline: images re-enabled but `urlTransform`
  limits `src` to same-origin uploads; a YouTube/Vimeo link renders a **sandboxed iframe** built from a
  validated id (never the raw URL); links unchanged. CSP (serve-client mode) adds a `frame-src`
  allowlist (youtube-nocookie / vimeo).
- **No new runtime dependency** — `multer` is already transitive via `@nestjs/platform-express`, and the
  file is typed with a minimal local interface (no `@types/multer`). Docker gains an `/app/uploads`
  volume + `UPLOAD_DIR`.
- Follow-ups: disk GC of orphaned files, per-user quota, project-scoped cascade, external-image support
  behind `img-src https:`, uploaded-video support.

### Fix — media toolbar was invisible and image picks were silently dropped (2026-07-30)

Two bugs made the card media toolbar unusable:

- **Invisible toolbar.** `.whiteboard__card-edit-toolbar` hard-coded a white background but never set
  `color`; its `.ghost` buttons are `color: inherit`, which resolves to **white** under the root's
  `color-scheme: light dark` on a dark OS theme — white-on-white. Now uses the adaptive
  `Canvas`/`CanvasText` pair like every other floating panel, which also restores `--border`
  (= `currentColor 18%`).
- **Upload never completed.** Opening the native file picker blurs the document, and the textarea's
  `onBlur` ended edit mode unconditionally → the toolbar (and its file input + mutation) unmounted while
  the picker was open → the `change` event fired on a detached node and never reached React. Fixed by
  (a) `shouldEndEditing` (pure, unit-tested) — a blur that is document-level focus loss, or focus moving
  into the card's own chrome, no longer exits edit mode; (b) moving the file input and the upload
  mutation into `CardView` (`useCardImageUpload`) so they outlive edit mode. Same blur guard also
  stabilises the `window.prompt`-based Video/Link buttons.
- Also: client-side 5 MB pre-check (mirrors `MAX_UPLOAD_BYTES`) instead of a raw 413, and the server's
  415 now names the accepted types. **No new dependencies.**

### Follow-up — in-place block editor: images and text together in a card (2026-07-30)

Editing a card used to swap its rendered content for one full-height textarea of raw Markdown, so a
picture vanished while you typed and the only delete affordance (the red ×) removed the whole card.
Cards are now edited as an ordered stack of **blocks** — text blocks are textareas, image blocks stay
rendered as pictures where they were authored.

- **`cardBlocks.ts` (pure, 31 tests).** `splitBlocks`/`joinBlocks` view `card.content` as blocks;
  **storage is unchanged** (still one Markdown string). Only a line that is _solely_ an image becomes an
  image block — an image inside a sentence stays text, so nothing the user wrote is ever reordered. Join
  drops the empty slots `editableBlocks` adds, which makes the round-trip idempotent. An image line is
  only lifted into a block if its src passes the **same** `transformCardUrl` policy the renderer applies,
  so the editor can't load an external image the display path would have dropped.
- **`CardBlockEditor` + `useCardBlocks`.** Insert-at-caret splits the current text block so an upload
  lands exactly where the cursor was; arrows walk across images between blocks; Backspace at the start of
  a block selects the image above it and a second press removes it — two steps, because card content
  edits are **not** on the undo stack.
- **`CardImageBlock`** carries a × that removes only that image; used by the editor _and_ by
  `CardMarkdown` (via an optional `onRemoveImage`, omitted in the read-only share view — without it the
  rendered markup is unchanged, so the XSS/security tests still pass untouched).
- Canvas keyboard/wheel now defer to a card marked `data-card-editing`: Delete on a selected image block
  removes the image rather than the card, and the wheel scrolls the block stack instead of panning.
- Known follow-up: a video embed's iframe swallows pointer events, so a card that is mostly a video is
  hard to double-click into — fixing it means an overlay that costs one-click playback.

### Follow-up — drag to resize an image inside a card (2026-08-01)

Card images rendered at a size the software picked (`max-width: 100%` + `max-height: 8em`) with no way
to change it, so a diagram you needed to read was the same size as a decorative icon. Hovering an image
now reveals a **grip on its right edge**; drag it to set the image's width, with a live preview and one
commit on release.

- **Storage is unchanged — no migration, no DTO, no server change.** The width rides in the Markdown
  **title slot**: `![alt](/api/uploads/… "w=320")`. The title is an _annotation_, so `src` keeps being
  exactly the upload URL — which matters because `removeImageBySrc`, the editor's React keys, and any
  future "which upload is this" logic all compare on `src`. `splitBlocks`/`joinBlocks` already
  round-tripped a title losslessly, so this needed no change to the block model's serialiser.
- **`imageSize.ts` (pure, 35 tests)** owns the whole format (`w=\d{2,4}` — the grammar itself cannot
  express an out-of-range value) and the drag math. `imageMarkdown` is the single emitter and _drops_ a
  width it cannot carry, so it is structurally incapable of writing a line that doesn't re-parse; that
  is what keeps split→join idempotent. Width only, never height: with `height: auto` the browser
  re-derives the height from the **used** width, so the aspect ratio survives even when a narrow card
  clamps the image.
- **Default behaviour is untouched.** An image that has never been resized carries no title and
  serialises byte-identically to `![](src)`, keeping the `8em` cap. All 31 pre-existing `cardBlocks`
  assertions pass unedited — `width?: number` is optional, so `toEqual` ignores it.
- **`useImageResize`** mirrors `useCardResize`: window pointer listeners, delta ÷ zoom re-read every
  move, transient preview, one commit on release. It measures `offsetWidth` (untransformed layout px =
  world px) rather than `getBoundingClientRect`, and starts from the **rendered** width, because
  `max-width: 100%` means stored ≠ rendered whenever a card was narrowed after its image was sized. It
  also listens for `pointercancel` and aborts without committing — a gap `useCardResize` still has.
- **No new dependency, no new CSP surface.** The size is an inline `style={{ width }}`, which
  `style-src 'unsafe-inline'` already permits for card positioning. Raw HTML (`<img width=…>`) was
  explicitly rejected: it would need `rehype-raw` and demolish the XSS-safe-by-construction model.
- **Residual risks / known limitations:**
  - Image resize is **not undoable**, like every other `card.content` edit (`useCardHistory` covers
    geometry only). Bringing all content edits into history is the right fix, not a special case.
  - Two images sharing one `src` in the same card: the grip on the rendered card sizes the **first**
    one, because react-markdown gives the `img` override no positional info. `removeImageBySrc` has the
    same limitation today. The block editor's path is index-based and therefore exact.
  - An explicit width is **px and does not scale with the card's `fontSize`**, unlike the `8em` default
    cap it replaces — deliberate, so sizes stay stable, but the two behave differently.
  - The `×` remove button now hugs the **image** rather than the card, a side effect of shrink-wrapping
    the image block so the grip lands on the right edge. Accepted: the × was previously detached from
    the thing it deletes.
  - Keyboard resize is not implemented. The editor path could take Shift+Arrow safely (it is debounced);
    the rendered card's path is un-debounced, so key-repeat there would storm the API.

---

### Follow-up — Notes view: read a board's cards as a list (2026-08-05)

#### What was done

Every board gained a second, **read-only** view. A segmented Whiteboard/Notes toggle in the board topbar
switches between today's canvas and a vertical list of the same cards — in the order a person would read
them off the board, images included. Nothing in the notes view edits: it is a projection of the
whiteboard, not a second store. Available on both `/projects/:id` and the public `/share/:token`.

#### How it was done

**No backend, Prisma, DTO, or API change, and no new dependency.** A `Card` already carries everything
(`x`, `y`, `content`, `color`), images already live inside `content` as `![alt](/api/uploads/… "w=…")`,
and `CardMarkdown` is already an audited safe renderer for exactly that string.

- **State in the URL.** `client/src/notes/viewMode.ts` is the client's only URL-state module
  (`parseViewMode` / `withViewMode`); `useViewMode` wraps `useSearchParams`. `?view=notes` survives a
  refresh, is linkable, and Back undoes the toggle (push, not replace). Anything that is not exactly
  `notes` reads as the whiteboard, with no redirect and no URL rewrite.
- **Reading order, not `zIndex`.** `client/src/notes/noteOrder.ts` groups cards into horizontal bands
  (`ROW_BAND_PX = 48`) anchored to the card that opened each band, then reads each band left to right.
  `zIndex` is paint order and shifts on every bring-to-front, so a list keyed on it would reshuffle as
  you click around. The sort copies its input first — the argument is the react-query cache array.
- **No per-note headings.** A card has no title column. An early version derived one from the first
  line of `content`, but the body then rendered that same line directly underneath, so every note
  showed its opening line twice — see the correction below. A note is its content and nothing else.
- **Renderer reused verbatim.** `NoteItem` uses `CardMarkdown`'s no-editing-props path — the same one the
  share view uses — rather than a second Markdown pipeline.
- **One shell for both routes.** `client/src/components/BoardScreen.tsx` absorbed the topbar both pages
  hand-rolled, so the toggle and the whiteboard/notes branch exist in exactly one file. It also makes
  `NotesView` the lazy boundary, keeping the remark stack out of the initial chunk.

#### What changed

- New `client/src/notes/`: `viewMode.ts`, `useViewMode.ts`, `noteOrder.ts`, `ViewSwitch.tsx`,
  `NoteItem.tsx`, `NotesView.tsx`, `notes.css` (+ colocated test files).
- New `client/src/components/BoardScreen.tsx`; `WhiteboardPage.tsx` and `SharedWhiteboardPage.tsx` both
  shrank onto it.
- `client/src/index.css` imports `notes.css` **last** — the notes view reuses the card markup, so a few
  rules override `cards.css` for a document layout (the content box must grow rather than clip, and
  images run to the text edge with the stored `w=…` acting as a target under `max-width: 100%`).
- Client suite 193 → 239 tests. Build splits a separate `NotesView` chunk; the 155 kB Markdown chunk
  stayed out of the main bundle.

#### Security notes (Notes view scope)

- **No new endpoint, no new dependency, no CSP change.** The inline image `width` is already covered by
  the same `style-src` allowance card positioning uses.
- **The share route still issues zero authenticated requests.** `NotesView` takes `readOnly` with the
  same name and meaning as `WhiteboardCanvas` and passes `useCards(projectId, { enabled: !readOnly })`.
  The error state's Retry button is rendered only when `!readOnly`, because `refetch()` bypasses
  `enabled` and would fire an owner-scoped request from an anonymous page.
- All rendering goes through the existing `CardMarkdown` path: no `rehype-raw`, `urlTransform` limiting
  image `src` to same-origin uploads, sandboxed video embeds.
- **This feature builds no strings out of user content.** The whole card payload goes through
  `CardMarkdown`'s audited path, so there is no second escaping surface to get wrong;
  `NoteItem.test.tsx` asserts a `<script>` in the content is escaped and that an external image URL
  never renders.

#### Residual risks / follow-ups

- **Relation arrows are not represented.** An arrow is a spatial relation with no place in a reading
  order. The follow-up is cheap: `SharedWhiteboardPage` already seeds `connectionsKey`.
- A card's own `# H1` nests under the note's `<h2>` — an outline nit, unfixable without a rehype plugin
  in the shared renderer. Normalised visually.
- No virtualisation above a 150-note initial batch (`content-visibility: auto` plus a "show the rest"
  button). Revisit only if measurement shows it is insufficient.
- Stored `w=…` widths are read as absolute px in the column, so an image looks the size it did at 100%
  zoom on the board.
- Two minimum-height (40 px) cards stacked flush fall in one band and read left-to-right.
  `sortCardsForReading` takes a `band` override so a height-proportional rule stays contained.

---

### Fix — deploys served a stale client bundle (2026-08-06)

#### What was done

A deploy of the notes view left the site unchanged. The cause was operational, not a code defect: the
Docker **image was never rebuilt**. `npm run build` had been run on the host, `docker run` used the
existing `second-brain` tag, and the container kept serving the previous bundle. Diagnosing it took far
longer than it should have, because nothing in the running system says which build it is.

#### How it was done

The client bundle is fixed at image build time — `Dockerfile` copies `client/dist` in, `CLIENT_DIST`
points inside the image, `serve-client.ts` reads `index.html` **once at boot**, and the only volume is
`/app/uploads`. So the image tag is the sole determinant of which client runs, and a host-side build is
invisible to the container.

The fix makes that state observable and documents the step that was missing:

- `Dockerfile` takes `ARG GIT_SHA=dev` (re-declared in both stages, since an ARG does not cross stages)
  and the runtime stage sets `ENV BUILD_SHA=${GIT_SHA}`.
- `GET /health` gained a `build` field. It stays I/O-free and rate-limit-exempt, so it answers "which
  commit is this?" even when the database is unreachable.
- `BUILD_SHA` is deliberately **not** in `env.validation.ts`. It is optional with a safe default, like
  `CLIENT_DIST`; adding it to the fail-fast contract would break every local `node dist/main.js` run.
- The README's Docker section is now numbered and states outright that the SPA lives inside the image, so
  every code change needs a fresh `docker build`. It also gained the Linux `--add-host` note
  (`host.docker.internal` is a Docker Desktop convenience), the percent-encoding rule for `@` in a DB
  password, and a "stale page after a deploy?" triage line.

#### What changed

- `Dockerfile` — `ARG GIT_SHA` in both stages, `ENV BUILD_SHA` in the runtime stage.
- `server/src/health/health.controller.ts` — `build` on `HealthStatus`, from `process.env.BUILD_SHA`
  falling back to `dev` (`||`, not `??`, so `--build-arg GIT_SHA=` also degrades to the fallback).
- `server/src/health/health.controller.spec.ts` — **new**; this module previously had zero tests. Five
  cases, restoring `process.env.BUILD_SHA` after each so they stay independent.
- `README.md` — numbered rebuild-first deploy steps and four new operational notes.

#### Security notes (deploy-fix scope)

- A short commit sha is already public in the repository, so exposing it on an unauthenticated liveness
  endpoint discloses nothing new. The endpoint still performs no I/O and returns no user data — a test
  asserts the payload has exactly `status`, `uptime`, and `build`.
- No secret is baked into the image: `GIT_SHA` is a build arg, and build args are visible in image
  history, which is precisely why only the sha travels this way and credentials stay run-time env.
- The stale-image class of bug is a **security** concern, not only a cosmetic one: a container that
  silently keeps running old code also keeps running old security fixes.

#### Residual risks / follow-ups

- **Cache headers remain inverted** and were explicitly out of scope. `index.html` is served with no
  `Cache-Control` (a proxy may hold a stale shell), while content-hashed `assets/*` get `max-age=0`
  (a revalidation round trip each). The correct pairing is `no-cache` on the shell and
  `immutable` on the assets.
- A stale shell requesting a since-deleted asset hash falls through to the SPA fallback and receives
  **HTTP 200 with HTML**, surfacing as "MIME type text/html is not executable" rather than a clean 404.
- `serve-client.ts` degrades silently to API-only mode when `CLIENT_DIST` is missing or wrong: no log,
  and `/health` still returns 200, so the container looks healthy while serving no UI.
- `serve-client.ts` still has no test coverage; the e2e app boots with `CLIENT_DIST` unset.

---

### Follow-up — Notes view: a user-chosen page background (2026-08-06)

#### What was done

The notes view gained a background colour the owner picks from the card palette, stored on the
project so it follows the board across devices and browsers. A collapsed palette button in the board
topbar expands to "Default" plus the eight curated swatches; "Default" clears the choice and the page
goes back to following the OS light/dark theme.

#### How it was done

Almost entirely wiring — the pieces already existed and are already tested:

- **Storage.** `Project.notesBg`, a `#rrggbb` string defaulting to `''`. Empty means "no choice made",
  which is why the default is not a hex: every existing board keeps the theme-native surface, and
  "reset to default" is expressible without a nullable column. The migration is a single additive
  `ALTER TABLE` with a default — no backfill, no downtime.
- **Validation.** `NOTES_BG = /^(#[0-9a-fA-F]{6})?$/` in `update-project.dto.ts`. `ProjectsService.update`
  passes the field straight through; Prisma skips `undefined`, so a rename never clears the background
  and a recolour never touches the name.
- **Contrast.** `notesSurfaceStyle` (new, pure) returns `{}` when nothing is set and
  `{ background, color: contrastingTextColor(bg) }` otherwise. Pinning the text colour is mandatory,
  not decorative: the app runs on `color-scheme: light dark`, so under a dark OS theme the inherited
  text is light and a light swatch would render light-on-light. This is the same treatment `CardView`
  gives a card's own fill.
- **One painted surface.** `.notes` was rendered at four call sites — the error, loading and populated
  branches of `NotesView` plus `BoardScreen`'s Suspense fallback. A new `NotesSurface` component owns
  the background and all four route through it, so the colour is present from the first paint instead
  of appearing once the cards land. `.notes` became the full-bleed surface (`min-height: 100vh`) and the
  reading measure moved to `.notes__inner`, so the colour reaches the viewport edges rather than sitting
  behind the text column only.
- **Threaded, not fetched.** `notesBg` is passed down from `WhiteboardPage` through `BoardScreen`.
  `SharedWhiteboardPage` passes nothing and gets `''`. No `useProject` call was added anywhere in the
  notes path — see the security notes.

#### What changed

- `server/prisma/schema.prisma` + `migrations/20260806000000_add_project_notes_bg/`.
- `server/src/projects/dto/update-project.dto.ts`, `projects.service.ts`, `projects.service.spec.ts`
  (4 new cases: set, clear, one-field-at-a-time, IDOR).
- `client/src/api/{types,projects}.ts`, `client/src/hooks/useProjects.ts` (`useSetNotesBg`, optimistic
  on `['projects', id]` with rollback, per ADR D10).
- New `client/src/notes/{notesBg.ts,notesBg.test.ts,NotesSurface.tsx,NotesBgPicker.tsx}`.
- `client/src/notes/notes.css`, `client/src/components/BoardScreen.tsx`, `client/src/pages/WhiteboardPage.tsx`.
- Client 239 → 247 tests; server 73 → 77.

#### Security notes (notes-background scope)

- **The public share payload was deliberately left unchanged.** The background is an owner-side
  preference, so `share.service.ts` still selects `{ id, name }` only, no new field lands on an
  unauthenticated endpoint, and `server/test/` needed no edit at all. A shared board renders on the
  viewer's own theme surface.
- **`notesBg` is interpolated into a `style` attribute**, so the server-side `NOTES_BG` allowlist is the
  control that matters. `notesSurfaceStyle` re-validates with the same rule client-side and emits `{}`
  on anything unexpected — defence in depth, so a hand-edited row can never reach the DOM as CSS.
  The two regexes are duplicated by hand and must be changed in step.
- `PATCH /projects/:id` remains owner-scoped through `getOwned` (404, never 403), so the recolour route
  inherits the existing IDOR posture; a test asserts it refuses before touching a non-owned project.
- The picker is not rendered in the read-only share view, but that is presentation only — the
  authorization is server-side, as always.

#### Residual risks / follow-ups

- No custom `<input type="color">`, unlike `SelectionToolbar` — the curated palette keeps the fixed
  topbar narrow. The server already accepts any valid hex, so adding one later is UI-only.
- The whiteboard canvas still has a hardcoded white background; only the notes view is themeable.
- With a background set, the notes view no longer follows the OS dark theme for that board. That is
  inherent to honouring a light swatch, and "Default" restores theme-following.

---

### Follow-up — All-projects notes view with per-project include/exclude (2026-08-06)

#### What was done

An **All notes** button on the projects page opens `/notes`: every project's cards in one read-only
list, grouped by board, each group in the same reading order the single-board view uses. A filter bar
at the top of that page toggles which projects appear, and the choice is stored on the project so it
follows the user across devices.

#### How it was done

- **One endpoint, not a fan-out.** New `GET /api/notes` (`server/src/notes/`). The alternative — one
  `GET /projects/:id/cards` per project from the client — would have shared a single
  100-requests-per-minute **per-IP** throttle bucket with every other card read, so a large account
  could rate-limit itself; with `retry: false` set globally those 429s surface as hard errors with no
  recovery. It would also have introduced `useQueries`, a pattern the client does not otherwise use.
- **Authorization is the where-clause.** `where: { deletedAt: null, project: { ownerId, notesIncluded: true } }`
  — the same relation-filter idiom as `CardsService.assertCardsOwned`. There is no preceding ownership
  assertion because there is nothing to assert: a foreign card cannot be selected in the first place.
- **`Project.notesIncluded Boolean @default(true)`**, so every existing board appears the first time
  the view is opened. Patched through the existing `PATCH /projects/:id`; Prisma's `undefined`
  semantics mean `name`, `notesBg` and `notesIncluded` compose without clobbering each other, and a
  spec asserts exactly that.
- **Grouping is a pure function.** `groupNotesByProject` buckets by `projectId`, orders groups by the
  server's project order (`updatedAt desc`), sorts each with the existing `sortCardsForReading`, drops
  empty groups so a cardless board is not a bare heading, and drops cards whose project is missing from
  the list (only possible while the two queries are briefly out of step).
- **Headings stay correct in both views.** `NoteItem` took a `level` prop defaulting to `2`; the
  combined page passes `3`, because project names are the `h2` there.
- **Paging is across the flattened list**, not per group — otherwise one huge first board would hide
  every other project below the fold.

#### What changed

- `server/prisma/schema.prisma` + `migrations/20260806010000_add_project_notes_included/`.
- New `server/src/notes/{notes.module,notes.controller,notes.service,notes.service.spec}.ts`;
  registered in `app.module.ts`.
- `server/src/projects/dto/update-project.dto.ts`, `projects.service.ts`, `projects.service.spec.ts`.
- New `client/src/api/notes.ts`, `client/src/hooks/useAllNotes.ts`,
  `client/src/notes/{groupNotesByProject.ts,groupNotesByProject.test.ts,NotesProjectFilter.tsx}`,
  `client/src/pages/AllNotesPage.tsx`.
- `client/src/api/{types,projects}.ts`, `client/src/hooks/useProjects.ts` (`useSetNotesIncluded`),
  `client/src/notes/NoteItem.tsx`, `client/src/notes/notes.css`, `client/src/pages/ProjectsPage.tsx`,
  `client/src/App.tsx`, and a `.button-link` rule in `client/src/styles/base.css`.
- Server 77 → 85 tests; client 247 → 256.

#### Security notes (all-projects notes scope)

- **`GET /api/notes` is authorized entirely by its where-clause.** `project: { ownerId: userId }` means
  another user's cards are not merely filtered out of the response — they are never selected. There is
  no ownership pre-check to forget and no 404-vs-403 decision to get wrong (OWASP A01 / CWE-639). The
  spec asserts the clause directly, including that no caller-supplied `projectId` ever reaches it.
- **`NOTES_CARDS_MAX = 2000` bounds the read** (CWE-400). This is the only query in the app whose size
  scales with the caller's entire account rather than one board. The cap is **surfaced in the UI** when
  hit rather than truncating silently.
- **`notesIncluded` is a display preference, not an access control.** An excluded project stays fully
  readable at its own routes and its sharing is unaffected. Nothing should ever be hidden _for
  security_ by unticking it.
- The route sits behind `SessionAuthGuard` like every other owner route; unauthenticated calls 401.

#### Residual risks / follow-ups

- The combined view is a separate cache key from the per-board `['cards', projectId]` entries, so a
  card edited on a whiteboard is not reflected until `/notes` refetches on next mount. Deliberate —
  merging the caches would let the whiteboard's optimistic mutations write into this list.
- The page renders on the theme surface; a board's `notesBg` is not applied, since choosing one board's
  colour for a mixed list would be arbitrary.
- Above 2000 cards the view is capped with no "load more from the server" path.
- The filter bar lists every project with no search or grouping, which will get long for a large
  account.

---

### Fix — notes repeated every card's first line (2026-08-06)

#### What was done

Removed the per-note title heading and the card-colour dot. A note is now the card's rendered content
and nothing else.

#### How it was done

The title was **derived** — a card has no title column, so `deriveNoteTitle` took the first line of
`content` that rendered as text. The body then rendered that same line again immediately below it, so
in practice every note displayed its opening line twice. There was no version of the heuristic that
fixed this: the title was, by construction, text the body was also going to show.

The colour dot went with it. It had shared the title's row; on its own it would have occupied a line
to convey what the board already shows better.

Deleting the title removed the last place this feature constructed a string out of user content, so
the entire note payload now goes through `CardMarkdown`'s audited path. That is a strictly smaller
attack surface, not a lost control — the two XSS tests that guarded the title are gone because the
thing they guarded no longer exists, and `NoteItem.test.tsx` still asserts the content path escapes
`<script>`, drops external images, and refuses `javascript:` URLs.

#### What changed

- `client/src/notes/NoteItem.tsx` — title, colour chip, and the `level` prop all removed; the
  component is now props-in-content-out with no derivation.
- **Deleted** `client/src/notes/noteTitle.ts` and `noteTitle.test.ts` (~210 lines, 20 tests). Nothing
  else imported them, and the repo's rule is to remove dead code rather than leave it unreferenced.
- `client/src/notes/notes.css` — `.notes__head`, `.notes__chip`, `.notes__title` removed.
- `client/src/pages/AllNotesPage.tsx` — the `level={3}` argument is gone; project names remain the
  `h2` in the combined view, and notes contribute no headings of their own.
- Client 256 → 240 tests.

#### Residual risks / follow-ups

- Notes are now visually separated only by the divider rule between items. On a board of very short
  cards the list reads as a run of one-liners with no per-card anchor. If that becomes a problem the
  answer is a real `title` column on `Card`, not another heuristic.
- A card's own Markdown headings still render, so a board that uses `# ...` per card already gets
  headings for free.

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
  uses") — O(1) local reorder, merge-friendly (`gfx/layer.ts`). → _Our card stacking uses an
  **integer `zIndex`**, server-allocated (max+1) via a `bring-to-front` endpoint (Phase 6) — not
  a fractional string index; fractional indexing is the future path if concurrent reordering lands._
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
