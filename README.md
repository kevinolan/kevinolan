# FluentPath Platform — Monorepo

A speech-fluency therapy platform with three tiers that share one typed contract:

| Package | Stack | Purpose |
| --- | --- | --- |
| `shared/` | TypeScript + zod (dependency-free) | Domain types + validation schemas — the API contract consumed by every tier. |
| `backend/` | Node.js + Express + TypeScript (tsx) + **sql.js** (WASM SQLite) | Metrics ingestion + user store + REST API. |
| `speech-therapy-app/` | React 19 + Vite + on-device ONNX | Existing client PWA (records audio, runs the fine-tuned model locally, ingests metrics). |
| *(next)* `web-admin/` | Next.js | Clinician dashboard — consumes `backend` read APIs. |
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
| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ ok, time }` |
| POST | `/api/users` | `CreateUser` | `201 User` |
| GET | `/api/users` | — | `User[]` |
| GET | `/api/users/:id` | — | `User` (404 if missing) |
| POST | `/api/metrics` | `IngestMetrics` (batch, ≤200) | `202 { accepted, rejected, serverTime }` |
| GET | `/api/users/:id/metrics?limit=` | — | `StoredMetric[]` (newest-first, 404 if user missing) |

All request/response shapes are in `shared/src/domain.ts`.

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
- `backend`: `tsc --noEmit` clean, 8 vitest integration tests (real in-memory
  SQLite via supertest) covering users CRUD, metrics ingest + read, validation
  rejections, user-scoping, and 404s.
- Live smoke test confirmed a user + metric survive a full server restart
  (write-through persistence).

## Not yet built (next slices, per plan)
- `web-admin/` (Next.js) — clinician dashboard over the read APIs above.
- `mobile/` (React Native) — client app reusing the on-device coach/model and
  posting metrics to `/api/metrics`.
- Auth (the API is currently unauthenticated — add token/session middleware
  before any deployment).
