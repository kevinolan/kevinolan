/**
 * Server entrypoint. Opens the persisted DB, builds the app, listens on PORT.
 *
 * Durability model: every mutating request persists immediately (write-through)
 * in app.ts, so we never rely on a timer. The only flush on shutdown is a
 * belt-and-braces persist() before close().
 *
 * NOTE: sql.js keeps the whole DB in memory and writes the file on export(). It
 * is safe for a SINGLE process. Running two instances against the same file is
 * unsafe (each has an independent in-memory copy) — for multi-process / production
 * use better-sqlite3 (with file locking) or a server database (Postgres). See README.
 */
import { openDb } from './db.js';
import { createApp } from './app.js';
import { ensureSeeded } from './repo.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  const handle = await openDb();
  // Single-writer seed: creates a default clinician if none exists, through the
  // same connection the server uses (no separate-connection race).
  ensureSeeded(handle);
  const app = createApp(handle);

  let shuttingDown = false;
  const shutdown = (sig: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[fluentpath-backend] ${sig} received, flushing + closing`);
    try {
      handle.persist();
    } catch (e) {
      console.error('[fluentpath-backend] persist failed', e);
    }
    handle.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  app.listen(PORT, () => {
    console.log(`[fluentpath-backend] listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[fluentpath-backend] failed to start', err);
  process.exit(1);
});
