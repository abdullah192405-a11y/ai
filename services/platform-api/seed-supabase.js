/* Seeds Supabase connection settings on local websites and verifies REST access.

   Usage:
     npm run seed:supabase

   Requires in .env:
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_ANON_KEY=eyJ...   (anon or publishable key — never service_role) */
import 'dotenv/config';
import { pool, query, ensureSchema } from './src/db.js';
import { fetchLiveDatabaseCatalog } from './src/knowledge/liveData.js';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();

function requireEnv() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
  if (missing.length) {
    console.error(`[seed-supabase] Missing: ${missing.join(', ')}`);
    console.error('  Add them to services/platform-api/.env (see .env.example)');
    process.exit(1);
  }
  if (/service_role/i.test(supabaseAnonKey)) {
    console.error('[seed-supabase] SUPABASE_ANON_KEY must be the anon/publishable key, not service_role.');
    process.exit(1);
  }
}

async function wireWebsites() {
  const patch = JSON.stringify({ supabaseUrl, supabaseAnonKey });
  const { rows } = await query(
    `UPDATE websites
     SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb
     RETURNING id, tenant_id`,
    [patch]
  );
  return rows;
}

async function verifyConnection() {
  const data = await fetchLiveDatabaseCatalog(
    { supabaseUrl, supabaseAnonKey },
    { fullSync: true }
  );
  return data;
}

async function main() {
  requireEnv();
  await pool.query('SELECT 1');
  await ensureSchema();

  const websites = await wireWebsites();
  console.log(`[seed-supabase] Updated ${websites.length} website(s) with Supabase credentials.`);

  const data = await verifyConnection();
  if (!data.total) {
    console.error('[seed-supabase] Connection failed — 0 records returned from Supabase.');
    console.error('  Check SUPABASE_URL / SUPABASE_ANON_KEY and RLS SELECT policies.');
    process.exit(1);
  }

  const sample = (data.allItems || []).slice(0, 3).map((i) => `  • ${i.title} (${i.type})`);

  console.log('\n══════════════════════════════════════════════════════');
  console.log(' Supabase connection OK');
  console.log('══════════════════════════════════════════════════════');
  console.log(` URL    : ${supabaseUrl}`);
  console.log(` Schema : ${data.schema}`);
  console.log(` Total  : ${data.total} records`);
  console.log(' Sample :');
  console.log(sample.join('\n') || '  (none)');
  console.log('\n Open the user app → Knowledge Base to see Supabase status.');
  console.log('══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch((err) => {
  console.error('[seed-supabase] failed:', err.message || err);
  if (err.code === 'ECONNREFUSED') {
    console.error('\n  Postgres is not running. From repo root: docker compose up -d postgres\n');
  }
  process.exit(1);
});
