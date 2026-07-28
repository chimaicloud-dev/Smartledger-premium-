/**
 * Lightweight PostgreSQL session store for express-session.
 * Replaces connect-pg-simple to avoid the bundled file-path issue
 * where esbuild can't resolve connect-pg-simple's table.sql at runtime.
 */
import type { Store } from "express-session";
import type { Pool } from "pg";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR    NOT NULL PRIMARY KEY,
    "sess"   JSON       NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class PgSessionStore extends (require("express-session").Store as new () => Store) {
  private pool: Pool;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  async init(): Promise<void> {
    await this.pool.query(CREATE_TABLE_SQL);
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    if (this.pruneTimer?.unref) this.pruneTimer.unref();
  }

  private async prune(): Promise<void> {
    try {
      await this.pool.query(`DELETE FROM "session" WHERE expire < NOW()`);
    } catch {
      // ignore prune errors
    }
  }

  get(sid: string, cb: (err: any, session?: any) => void): void {
    this.pool
      .query<{ sess: any }>(
        `SELECT sess FROM "session" WHERE sid = $1 AND expire > NOW()`,
        [sid]
      )
      .then((r) => cb(null, r.rows[0]?.sess ?? null))
      .catch(cb);
  }

  set(sid: string, session: any, cb?: (err?: any) => void): void {
    const maxAge = session?.cookie?.maxAge ?? 86400;
    const expire = new Date(Date.now() + maxAge * 1000);
    this.pool
      .query(
        `INSERT INTO "session" (sid, sess, expire)
         VALUES ($1, $2, $3)
         ON CONFLICT (sid) DO UPDATE
           SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
        [sid, JSON.stringify(session), expire]
      )
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }

  destroy(sid: string, cb?: (err?: any) => void): void {
    this.pool
      .query(`DELETE FROM "session" WHERE sid = $1`, [sid])
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }

  touch(sid: string, session: any, cb?: (err?: any) => void): void {
    const maxAge = session?.cookie?.maxAge ?? 86400;
    const expire = new Date(Date.now() + maxAge * 1000);
    this.pool
      .query(
        `UPDATE "session" SET expire = $2 WHERE sid = $1`,
        [sid, expire]
      )
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }
}
