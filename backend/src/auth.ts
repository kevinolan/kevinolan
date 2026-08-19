/**
 * Minimal, dependency-free auth primitives.
 *
 * - Passwords: scrypt (Node crypto) with a per-user random salt. No plaintext or
 *   reversible storage.
 * - Tokens: HMAC-SHA256 (HS256) JWT, signed with a server secret. Stateless —
 *   the clinician dashboard sends `Authorization: Bearer <token>` and we verify
 *   the signature + expiry locally (no session store).
 *
 * This is "minimal auth" not "full auth": there's no refresh rotation, rate
 * limiting, or MFA. It is enough to scope clinician vs. client and protect the
 * read APIs. Put real secrets in the environment before any deployment.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomUUID } from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h clinician sessions

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    // Dev fallback so local runs work without config. NEVER rely on this in prod.
    return 'dev-only-insecure-secret-change-me-please-0000';
  }
  return s;
}

// ── Passwords ────────────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// ── JWT (HS256) ───────────────────────────────────────────────────────────

interface JwtClaims {
  sub: string; // user id
  role: 'client' | 'clinician';
  email: string;
  exp: number; // seconds since epoch
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlJson(obj: unknown): string {
  return base64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}
function fromBase64url(s: string): Buffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

export function signToken(claims: { sub: string; role: 'client' | 'clinician'; email: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = { ...claims, exp: now + TOKEN_TTL_SECONDS };
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = base64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = base64url(createHmac('sha256', getSecret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = base64url(
    createHmac('sha256', getSecret()).update(`${header}.${body}`).digest(),
  );
  // Constant-time compare to avoid signature timing leaks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromBase64url(body).toString('utf8')) as JwtClaims;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract a bearer token from an Authorization header, or null. */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export { randomUUID };
