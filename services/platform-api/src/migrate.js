import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.join(__dirname, '..', '..', '..', 'database', 'schemas');

/** Apply numbered SQL migrations idempotently on startup. */
export async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const files = (await fs.readdir(SCHEMAS_DIR))
    .filter((f) => /^\d{3}-.+\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    const { rows } = await query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
    if (rows.length) continue;

    const sql = await fs.readFile(path.join(SCHEMAS_DIR, file), 'utf8');
    await query(sql);
    await query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
    console.log(`[migrate] applied ${file}`);
  }
}
