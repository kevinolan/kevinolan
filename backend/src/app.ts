/**
 * Express application factory. The DbHandle is injected so tests can pass an
 * in-memory DB and supertest can drive the app without binding a port.
 *
 * Auth model (minimal): clinician endpoints require `Authorization: Bearer <JWT>`.
 * The public client endpoints (create user, ingest metrics) remain open so the
 * PWA / mobile app can sync without a login — they only ever write their OWN
 * userId's metrics by UUID, and cannot read anyone else's. The clinician reads
 * are what we gate.
 */
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import {
  IngestMetricsSchema,
  CreateUserSchema,
  LoginRequestSchema,
  type ApiError,
  type AuthResponse,
} from '@fluentpath/shared';
import type { DbHandle } from './db.js';
import {
  createUser,
  getUser,
  ingestBatch,
  listMetrics,
  listUsers,
  authenticate,
  summarizeUser,
} from './repo.js';
import { signToken, verifyToken, extractToken } from './auth.js';

function notFound(db: DbHandle, res: Response, id: string) {
  res.status(404).json({ error: 'user_not_found', detail: id } satisfies ApiError);
}

/** Require a valid bearer token; attach the verified claims to req.auth. */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.header('authorization'));
  const claims = token ? verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ error: 'unauthorized', detail: 'missing_or_invalid_token' } satisfies ApiError);
    return;
  }
  (req as Request & { auth: typeof claims }).auth = claims;
  next();
}

export function createApp(db: DbHandle): Express {
  const app = express();
  app.use(cors()); // open CORS for the admin SPA + local dev; tighten per-env in prod
  app.use(express.json({ limit: '1mb' }));

  // Health / readiness (open)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // ── Auth ───────────────────────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const parsed = LoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_login', detail: parsed.error.message } satisfies ApiError);
    }
    const user = authenticate(db, parsed.data.email, parsed.data.password);
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' } satisfies ApiError);
    }
    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    const body: AuthResponse = { token, user };
    res.json(body);
  });

  // Current clinician (open to any valid token)
  app.get('/api/me', requireAuth, (req, res) => {
    const claims = (req as Request & { auth: { sub: string } }).auth;
    const user = getUser(db, claims.sub);
    if (!user) return res.status(404).json({ error: 'user_not_found' } satisfies ApiError);
    res.json(user);
  });

  // ── Users (public create; list/graph protected) ─────────────────────────
  app.post('/api/users', (req, res) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_user', detail: parsed.error.message } satisfies ApiError);
    }
    // The public endpoint never accepts a password (clients have no login yet).
    const { password: _ignore, ...clean } = parsed.data;
    const user = createUser(db, clean);
    db.persist(); // write-through: never lose a created user
    res.status(201).json(user);
  });

  app.get('/api/users', requireAuth, (_req, res) => {
    res.json(listUsers(db));
  });

  app.get('/api/users/:id', requireAuth, (req, res) => {
    const user = getUser(db, req.params.id);
    if (!user) return notFound(db, res, req.params.id);
    res.json(user);
  });

  // Aggregated per-patient summary for the clinician dashboard.
  app.get('/api/users/:id/summary', requireAuth, (req, res) => {
    const summary = summarizeUser(db, req.params.id);
    if (!summary) return notFound(db, res, req.params.id);
    res.json(summary);
  });

  // Clinician-only: list every patient (role-gated, not just authenticated).
  app.get('/api/patients', requireAuth, (req, res) => {
    const claims = (req as Request & { auth: { role: string } }).auth;
    if (claims.role !== 'clinician') {
      return res.status(403).json({ error: 'forbidden', detail: 'clinician_only' } satisfies ApiError);
    }
    const patients = listUsers(db)
      .filter((u) => u.role === 'client')
      .map((u) => summarizeUser(db, u.id))
      .filter((s): s is NonNullable<typeof s> => s !== null);
    res.json(patients);
  });

  // ── Metrics ingestion (mobile / desktop clients) ──────────────────────────
  app.post('/api/metrics', (req, res) => {
    const parsed = IngestMetricsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_metrics', detail: parsed.error.message } satisfies ApiError);
    }
    const { accepted, rejected } = ingestBatch(db, parsed.data);
    db.persist(); // write-through: persist ingested metrics immediately
    const ack = {
      accepted,
      rejected,
      serverTime: new Date().toISOString(),
    };
    res.status(202).json(ack);
  });

  app.get('/api/users/:id/metrics', requireAuth, (req, res) => {
    const user = getUser(db, req.params.id);
    if (!user) return notFound(db, res, req.params.id);
    const limit = Number(req.query.limit ?? 200);
    res.json(listMetrics(db, req.params.id, Number.isFinite(limit) ? limit : 200));
  });

  // ── Error handler ───────────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'internal_error';
    res.status(500).json({ error: 'internal_error', detail: msg } satisfies ApiError);
  });

  return app;
}
