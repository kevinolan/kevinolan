import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openMemoryDb, type DbHandle } from './db.js';
import { createApp } from './app.js';

function sampleMetric(over: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    recordedAt: '2026-08-12T10:00:00.000Z',
    durationSec: 12,
    pStutter: 0.42,
    heuristic: {
      repetitions: 2,
      prolongations: 1,
      blocks: 0,
      wordCount: 40,
      ratePerMin: 180,
      disfluencies: 3,
    },
    ...over,
  };
}

describe('backend API (in-memory DB)', () => {
  let db: DbHandle;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = await openMemoryDb();
    app = createApp(db);
  });

  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('POST /api/users accepts a valid client and returns 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'a@b.com', displayName: 'Ada', role: 'client' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.role).toBe('client');
  });

  test('POST /api/users rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'not-an-email', displayName: 'Ada' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_user');
  });

  test('users round-trip: create -> list -> get by id', async () => {
    const created = await request(app)
      .post('/api/users')
      .send({ email: 'c@d.com', displayName: 'Carl' });
    const id = created.body.id;

    const list = await request(app).get('/api/users');
    expect(list.status).toBe(200);
    expect(list.body.find((u: { id: string }) => u.id === id)).toBeTruthy();

    const one = await request(app).get(`/api/users/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.email).toBe('c@d.com');

    const missing = await request(app).get('/api/users/nope');
    expect(missing.status).toBe(404);
  });

  test('POST /api/metrics ingests a batch and GET returns it', async () => {
    const user = await request(app)
      .post('/api/users')
      .send({ email: 'e@f.com', displayName: 'Eve' });
    const userId = user.body.id;

    const res = await request(app)
      .post('/api/metrics')
      .send({
        userId,
        deviceId: 'dev-1',
        metrics: [
          sampleMetric(),
          sampleMetric({ id: 'm2', pStutter: null, recordedAt: '2026-08-12T11:00:00.000Z' }),
        ],
      });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(2);
    expect(res.body.rejected).toBe(0);

    const got = await request(app).get(`/api/users/${userId}/metrics`);
    expect(got.status).toBe(200);
    expect(got.body).toHaveLength(2);
    expect(got.body[0].pStutter).toBeNull(); // newest-first: m2 was last
  });

  test('POST /api/metrics rejects a malformed payload with 400', async () => {
    const res = await request(app)
      .post('/api/metrics')
      .send({ userId: 'u', deviceId: 'd', metrics: [{ id: 'x' }] }); // missing fields
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_metrics');
  });

  test('metrics are user-scoped (cannot read another user\'s data via the endpoint)', async () => {
    const a = await request(app).post('/api/users').send({ email: 'a1@x.com', displayName: 'A' });
    const b = await request(app).post('/api/users').send({ email: 'b1@x.com', displayName: 'B' });
    await request(app).post('/api/metrics').send({ userId: a.body.id, deviceId: 'd', metrics: [sampleMetric()] });

    const bMetrics = await request(app).get(`/api/users/${b.body.id}/metrics`);
    expect(bMetrics.body).toHaveLength(0);
  });

  test('GET metrics for a non-existent user returns 404', async () => {
    const res = await request(app).get('/api/users/ghost/metrics');
    expect(res.status).toBe(404);
  });
});
