/**
 * Express application factory. The DbHandle is injected so tests can pass an
 * in-memory DB and supertest can drive the app without binding a port.
 */
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import {
  IngestMetricsSchema,
  CreateUserSchema,
  type ApiError,
} from '@fluentpath/shared';
import type { DbHandle } from './db.js';
import {
  createUser,
  getUser,
  ingestBatch,
  listMetrics,
  listUsers,
} from './repo.js';

function notFound(db: DbHandle, res: Response, id: string) {
  res.status(404).json({ error: 'user_not_found', detail: id } satisfies ApiError);
}

export function createApp(db: DbHandle): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health / readiness
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // ── Users ───────────────────────────────────────────────────────────────
  app.post('/api/users', (req, res) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_user', detail: parsed.error.message } satisfies ApiError);
    }
    const user = createUser(db, parsed.data);
    db.persist(); // write-through: never lose a created user
    res.status(201).json(user);
  });

  app.get('/api/users', (_req, res) => {
    res.json(listUsers(db));
  });

  app.get('/api/users/:id', (req, res) => {
    const user = getUser(db, req.params.id);
    if (!user) return notFound(db, res, req.params.id);
    res.json(user);
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

  app.get('/api/users/:id/metrics', (req, res) => {
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
