# FluentPath Platform — Monorepo

A speech-fluency therapy platform with three tiers that share one typed contract:

| Package | Stack | Purpose |
| --- | --- | --- |
| `shared/` | TypeScript + zod (dependency-free) | Domain types + validation schemas — the API contract consumed by every tier. |
| `backend/` | Node.js + Express + TypeScript (tsx) + **sql.js** (WASM SQLite) | Metrics ingestion + user store + REST API + minimal JWT auth. |
| `web-admin/` | Next.js (App Router) | Clinician dashboard — login + patient list with aggregated fluency stats. |
| `speech-therapy-app/` | React 19 + Vite + on-device ONNX | Existing client PWA (records audio, runs the fine-tuned model locally, ingests metrics). |
| *(next)* `mobile/` | React Native | Client app — reuses the on-device model + coach, syncs metrics to `backend`. |

## Architecture

```
 mobile (RN) ─┐
              ├─▶ POST /api/metrics ─▶ backend ─▶ SQLite (sql.js)
 desktop PWA ─┘        GET  /api/users/:id/metrics
                              │
                          web-admin (Next.js) reads
```

- **On-device inference stays local.** The stutter model (ONNX) runs in the
  browser / on the phone; only the *aggregated metrics* are sent to the backend
  for cross-device sync and clinician review. Raw audio never leaves the device.
- **One shared contract.** `shared/` defines `RecordingMetric`, `IngestMetrics`,
  `User`, etc. The backend validates every request with the same zod schemas the
  clients will use, so a breaking change is caught at the type level.

## Backend

### Run
```bash
cd backend
npm install
npm run dev        # tsx watch, PORT=4000 (set PORT env to override)
npm test           # vitest, in-memory SQLite — no external services
npm run db:reset   # wipe the dev database (data/fluentpath.db)
```

### API
| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | open | — | `{ ok, time }` |
| POST | `/api/auth/login` | open | `LoginRequest` | `200 AuthResponse { token, user }` (401 on bad creds) |
| GET | `/api/me` | token | — | `User` (the caller) |
| POST | `/api/users` | open* | `CreateUser` | `201 User` (*never accepts a password) |
| POST | `/api/metrics` | open | `IngestMetrics` (batch, ≤200) | `202 { accepted, rejected, serverTime }` |
| GET | `/api/users/:id` | token | — | `User` (404 if missing) |
| GET | `/api/users/:id/metrics?limit=` | token | — | `StoredMetric[]` (newest-first) |
| GET | `/api/users/:id/summary` | token | — | `UserSummary` (aggregates + trend) |
| GET | `/api/patients` | clinician | — | `UserSummary[]` (all clients) |

All request/response shapes are in `shared/src/domain.ts`. **Auth model:** client
endpoints (create user, ingest metrics) stay open so the PWA/mobile can sync
without a login — they only ever write their own `userId`'s metrics by UUID and
cannot read anyone else's. Clinician read endpoints require a `Bearer` JWT
(`Authorization` header); `/api/patients` is further restricted to the
`clinician` role. Passwords are scrypt-hashed; tokens are HS256 JWTs (12h). **Set
`JWT_SECRET` in any real deployment** — there is a dev-only fallback that must
not be used in production.

### Web admin
```bash
cd web-admin
npm install
npm run dev        # http://localhost:3000 (set NEXT_PUBLIC_BACKEND_URL to the backend)
```
The backend **auto-seeds a default clinician on startup** (via `repo.ensureSeeded`,
using the server's own connection — required because sql.js is single-process).
Default credentials unless overridden by env:
`clinician@fluentpath.dev` / `fluentpath-dev-1234`. Override with
`CLINICIAN_EMAIL` / `CLINICIAN_PASSWORD` / `CLINICIAN_NAME` (set `JWT_SECRET` in
prod). The `npm run seed:clinician` script is an offline alternative for seeding a
DB file that no running server holds.

### Data layer
- **sql.js (pure-WASM SQLite)** — chosen because this environment has no reliable
  native build toolchain. The DB module (`backend/src/db.ts`) is the *only* place
  that touches the driver, so swapping to `better-sqlite3` for production needs no
  changes elsewhere.
- **Durability:** every mutating request persists immediately (write-through), so
  a crash between requests loses at most the in-flight one. On SIGINT/SIGTERM the
  server flushes once and closes cleanly.
- **⚠️ Single-process only.** sql.js holds the whole DB in memory; two processes
  opening the same file will have independent copies and the last writer wins. For
  multi-instance / production, use `better-sqlite3` (file locking) or a server DB.

## What's verified
- `backend`: `tsc --noEmit` clean, 11 vitest integration tests (real in-memory
  SQLite via supertest) covering users CRUD, metrics ingest + read, validation
  rejections, user-scoping, 401/403 auth gating, login, and clinician patient
  summaries with trend.
- `shared`: `tsc --noEmit` clean (contract types + zod schemas).
- `web-admin`: `next build` succeeds (App Router, login + patient list + detail).
- Live smoke test confirmed a user + metric survive a full server restart
  (write-through persistence).

## Not yet built (next slices, per plan)
- `mobile/` (React Native) — client app reusing the on-device coach/model and
  posting metrics to `/api/metrics`.
- Production hardening: real secret management, refresh tokens, rate limiting,
  and a production-grade DB (better-sqlite3 / Postgres) — sql.js is single-process.
