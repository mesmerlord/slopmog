import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ─── Lazy-init SQLite cache ─────────────────────────────────

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const DB_PATH = path.join(CACHE_DIR, "scrapecreators.db");

let db: Database.Database | null = null;
let writeCount = 0;

function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      url TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      ttl_seconds INTEGER NOT NULL
    )
  `);

  return db;
}

// ─── Public API ─────────────────────────────────────────────

export function cacheGet<T>(url: string): T | null {
  const conn = getDb();
  const row = conn
    .prepare(
      "SELECT body, cached_at, ttl_seconds FROM cache WHERE url = ?",
    )
    .get(url) as
    | { body: string; cached_at: number; ttl_seconds: number }
    | undefined;

  if (!row) return null;

  const expiresAt = row.cached_at + row.ttl_seconds;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (nowSeconds > expiresAt) {
    // Expired — remove it
    conn.prepare("DELETE FROM cache WHERE url = ?").run(url);
    return null;
  }

  return JSON.parse(row.body) as T;
}

export function cacheSet(url: string, data: unknown, ttlSeconds: number): void {
  const conn = getDb();
  const nowSeconds = Math.floor(Date.now() / 1000);

  conn
    .prepare(
      `INSERT OR REPLACE INTO cache (url, body, cached_at, ttl_seconds)
       VALUES (?, ?, ?, ?)`,
    )
    .run(url, JSON.stringify(data), nowSeconds, ttlSeconds);

  writeCount++;
  if (writeCount % 100 === 0) {
    purgeExpired();
  }
}

// ─── Internal cleanup ───────────────────────────────────────

function purgeExpired(): void {
  const conn = getDb();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const result = conn
    .prepare("DELETE FROM cache WHERE (cached_at + ttl_seconds) < ?")
    .run(nowSeconds);
  if (result.changes > 0) {
    console.log(`[cache] purged ${result.changes} expired entries`);
  }
}
