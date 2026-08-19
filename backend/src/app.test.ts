import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openMemoryDb, type DbHandle } from './db.js';
import { createApp } from './app.js';
import { signToken } from './auth.js';
import { createUser } from './repo.js';

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

function authHeader(claims: { sub: string; role: 'client' | 'clinician'; email: string }) {
  return `Bearer ${signToken(claims)}`;
}

describe('backend API (in-memory DB)', () => {
  let db: DbHandle;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = await openMemoryDb();
    app = createApp(db);
  });

  test('GET /api/health (open)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('POST /api/users accepts a valid client (open) and returns 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'a@b.com', displayName: 'Ada', role: 'client' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('client');
  });

  test('POST /api/users rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'not-an-email', displayName: 'Ada' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_user');
  });

  test('POST /api/users ignores a password on the public endpoint', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'sec@x.com', displayName: 'Sec', role: 'client', password: 'supersecret123' });
    expect(res.status).toBe(201);
    // Public create never stores a usable password -> cannot log in with it.
    const login = await request(app).post('/api/auth/login').send({ email: 'sec@x.com', password: 'supersecret123' });
    expect(login.status).toBe(401);
  });

  test('protected reads require a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('login returns a token for a seeded clinician, and /api/me works', async () => {
    const clinician = createUser(db, { email: 'doc@x.com', displayName: 'Dr', role: 'clinician', password: 'password123' });
    db.persist();

    const login = await request(app).post('/api/auth/login').send({ email: 'doc@x.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.role).toBe('clinician');

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(clinician.id);

    const badPw = await request(app).post('/api/auth/login').send({ email: 'doc@x.com', password: 'wrong' });
    expect(badPw.status).toBe(401);
  });

  test('clinician can list patients with summaries; client cannot', async () => {
    const clinician = createUser(db, { email: 'doc@x.com', displayName: 'Dr', role: 'clinician', password: 'password123' });
    const patient = createUser(db, { email: 'p@x.com', displayName: 'Pat', role: 'client' });
    db.persist();
    const token = authHeader({ sub: clinician.id, role: 'clinician', email: 'doc@x.com' });

    await request(app).post('/api/metrics').send({ userId: patient.id, deviceId: 'd', metrics: [sampleMetric()] });

    const patients = await request(app).get('/api/patients').set('Authorization', token);
    expect(patients.status).toBe(200);
    expect(patients.body.length).toBe(1);
    expect(patients.body[0].id).toBe(patient.id);
    expect(patients.body[0].avgDisfluencies).toBe(3);

    // a non-clinician token is forbidden
    const clientTok = authHeader({ sub: patient.id, role: 'client', email: 'p@x.com' });
    const forbidden = await request(app).get('/api/patients').set('Authorization', clientTok);
    expect(forbidden.status).toBe(403);
  });

  test('patient summary computes aggregates + trend', async () => {
    const clinician = createUser(db, { email: 'doc@x.com', displayName: 'Dr', role: 'clinician', password: 'password123' });
    const patient = createUser(db, { email: 'p@x.com', displayName: 'Pat', role: 'client' });
    db.persist();
    const token = authHeader({ sub: clinician.id, role: 'clinician', email: 'doc@x.com' });
    await request(app).post('/api/metrics').send({
      userId: patient.id,
      deviceId: 'd',
      metrics: [
        sampleMetric({ id: 'm1', pStutter: 0.1, recordedAt: '2026-08-12T09:00:00.000Z' }),
        sampleMetric({ id: 'm2', pStutter: 0.5, recordedAt: '2026-08-12T10:00:00.000Z' }),
        sampleMetric({ id: 'm3', pStutter: 0.9, recordedAt: '2026-08-12T11:00:00.000Z' }), // rising
      ],
    });
    const sum = await request(app).get(`/api/users/${patient.id}/summary`).set('Authorization', token);
    expect(sum.status).toBe(200);
    expect(sum.body.metricCount).toBe(3);
    expect(sum.body.avgPStutter).toBeCloseTo(0.5, 5);
    expect(sum.body.trend).toBe('up');
  });

  test('POST /api/metrics ingests a batch (open) and GET returns it (auth)', async () => {
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

    // GET now requires auth
    const noAuth = await request(app).get(`/api/users/${userId}/metrics`);
    expect(noAuth.status).toBe(401);
    const got = await request(app)
      .get(`/api/users/${userId}/metrics`)
      .set('Authorization', authHeader({ sub: userId, role: 'client', email: 'e@f.com' }));
    expect(got.status).toBe(200);
    expect(got.body).toHaveLength(2);
  });

  test('POST /api/metrics rejects a malformed payload with 400', async () => {
    const res = await request(app)
      .post('/api/metrics')
      .send({ userId: 'u', deviceId: 'd', metrics: [{ id: 'x' }] }); // missing fields
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_metrics');
  });

  test('GET metrics for a non-existent user returns 404', async () => {
    const res = await request(app)
      .get('/api/users/ghost/metrics')
      .set('Authorization', authHeader({ sub: 'ghost', role: 'clinician', email: 'x' }));
    expect(res.status).toBe(404);
  });
});
