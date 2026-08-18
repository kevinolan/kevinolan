/**
 * Data-access layer. Pure functions over a DbHandle. No HTTP concerns here so it
 * is trivially unit-testable with an in-memory DB.
 */
import { randomUUID } from 'node:crypto';
import type { DbHandle } from './db.js';
import type {
  IngestMetrics,
  RecordingMetric,
  User,
  CreateUser,
} from '@fluentpath/shared';

export function listUsers(db: DbHandle): User[] {
  const rows = db.db.exec(
    'SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC',
  )[0]?.values ?? [];
  return rows.map((r: unknown[]) => ({
    id: String(r[0]),
    email: String(r[1]),
    displayName: String(r[2]),
    role: r[3] as User['role'],
    createdAt: String(r[4]),
  }));
}

export function getUser(db: DbHandle, id: string): User | null {
  const res = db.db.exec(
    'SELECT id, email, display_name, role, created_at FROM users WHERE id = ?',
    [id],
  )[0]?.values ?? [];
  if (res.length === 0) return null;
  const r = res[0];
  return {
    id: String(r[0]),
    email: String(r[1]),
    displayName: String(r[2]),
    role: r[3] as User['role'],
    createdAt: String(r[4]),
  };
}

export function createUser(db: DbHandle, input: CreateUser): User {
  const user: User = {
    id: randomUUID(),
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    createdAt: new Date().toISOString(),
  };
  db.db.run(
    'INSERT INTO users (id, email, display_name, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.email, user.displayName, user.role, user.createdAt],
  );
  return user;
}

interface StoredMetric {
  id: string;
  userId: string;
  deviceId: string;
  recordedAt: string;
  durationSec: number;
  pStutter: number | null;
  repetitions: number;
  prolongations: number;
  blocks: number;
  wordCount: number;
  ratePerMin: number;
  disfluencies: number;
}

export function insertMetric(db: DbHandle, userId: string, deviceId: string, m: RecordingMetric): void {
  db.db.run(
    `INSERT OR REPLACE INTO metrics
       (id, user_id, device_id, recorded_at, duration_sec, p_stutter,
        repetitions, prolongations, blocks, word_count, rate_per_min, disfluencies)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.id,
      userId,
      deviceId,
      m.recordedAt,
      m.durationSec,
      m.pStutter,
      m.heuristic.repetitions,
      m.heuristic.prolongations,
      m.heuristic.blocks,
      m.heuristic.wordCount,
      m.heuristic.ratePerMin,
      m.heuristic.disfluencies,
    ],
  );
}

export function ingestBatch(db: DbHandle, payload: IngestMetrics): { accepted: number; rejected: number } {
  let accepted = 0;
  let rejected = 0;
  // Validate + upsert; a single bad row shouldn't roll back the whole batch.
  for (const m of payload.metrics) {
    try {
      insertMetric(db, payload.userId, payload.deviceId, m);
      accepted++;
    } catch {
      rejected++;
    }
  }
  return { accepted, rejected };
}

export function listMetrics(db: DbHandle, userId: string, limit = 200): StoredMetric[] {
  const res = db.db.exec(
    `SELECT id, user_id, device_id, recorded_at, duration_sec, p_stutter,
            repetitions, prolongations, blocks, word_count, rate_per_min, disfluencies
     FROM metrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?`,
    [userId, limit],
  )[0]?.values ?? [];
  return res.map((r: unknown[]) => ({
    id: String(r[0]),
    userId: String(r[1]),
    deviceId: String(r[2]),
    recordedAt: String(r[3]),
    durationSec: Number(r[4]),
    pStutter: r[5] === null ? null : Number(r[5]),
    repetitions: Number(r[6]),
    prolongations: Number(r[7]),
    blocks: Number(r[8]),
    wordCount: Number(r[9]),
    ratePerMin: Number(r[10]),
    disfluencies: Number(r[11]),
  }));
}
