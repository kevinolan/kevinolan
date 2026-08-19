// Client-side API helper. The admin SPA talks to the backend over HTTP and
// carries the clinician's JWT in the Authorization header (stored in memory /
// sessionStorage). No secrets live in the bundle.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; displayName: string; role: 'client' | 'clinician' };
}
export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  metricCount: number;
  earliestAt: string | null;
  latestAt: string | null;
  avgPStutter: number | null;
  avgDisfluencies: number | null;
  avgRatePerMin: number | null;
  trend: 'up' | 'down' | 'flat';
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error ?? 'login_failed');
  }
  return res.json();
}

async function authed(path: string, token: string): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchPatients(token: string): Promise<UserSummary[]> {
  const res = await authed('/api/patients', token);
  if (!res.ok) throw new Error('failed_to_load_patients');
  return res.json();
}

export async function fetchSummary(token: string, userId: string): Promise<UserSummary> {
  const res = await authed(`/api/users/${userId}/summary`, token);
  if (!res.ok) throw new Error('failed_to_load_summary');
  return res.json();
}
