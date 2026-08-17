import pg from 'pg';
import crypto from 'node:crypto';
import { env } from './config.js';

const isCloudDb =
  env.databaseUrl.includes('neon.tech') ||
  env.databaseUrl.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false,
});

// Prevent unhandled error event from crashing Node on idle client drops
pool.on('error', (err) => {
  console.error('[db] pool error:', err.message || String(err));
});

export function query(text, params) {
  return pool.query(text, params);
}

// sha-256 hex of an API key — what we store/compare against api_keys.key_hash.
export function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Generate a fresh API key. Returns { key, hash, prefix }.
// key looks like: pk_live_<43 url-safe chars>
export function generateApiKey() {
  const random = crypto.randomBytes(32).toString('base64url');
  const key = `pk_live_${random}`;
  return {
    key,
    hash: hashKey(key),
    prefix: key.slice(0, 16),
  };
}

// Legacy hook — migrations replace runtime DDL.
export async function ensureSchema() {
  const { runMigrations } = await import('./migrate.js');
  await runMigrations();
  const { ensureDocumentsTable } = await import('./knowledge/documentProcessor.js');
  await ensureDocumentsTable();
}
