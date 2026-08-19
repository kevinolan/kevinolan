// Offline seed tool: create the default clinician if it doesn't exist.
//
// NOTE: in normal dev the server already auto-seeds a clinician on startup
// (see repo.ensureSeeded) through its OWN connection, which avoids the
// sql.js single-writer race. Run this script only to (re)seed a database that
// no running server is holding — e.g. a fresh `data/fluentpath.db` before
// `npm run dev`, or to provision a clinician into a copy of the DB.
import { openDb } from '../src/db.js';
import { ensureSeeded } from '../src/repo.js';

const handle = await openDb();
ensureSeeded(handle);
handle.close();
console.log('[seed] done (clinician ensured via env: CLINICIAN_EMAIL / CLINICIAN_PASSWORD)');
