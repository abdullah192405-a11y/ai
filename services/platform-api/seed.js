/* Seeds one tenant + admin user + website + a fresh API key, then prints
   the plaintext key and a ready-to-paste embed snippet.

   Usage:  npm run seed
   Safe to re-run: the tenant/user/website are upserted; a NEW key is issued
   each run (old keys keep working until revoked). */
import bcrypt from 'bcryptjs';
import { env, DEFAULT_CONFIG } from './src/config.js';
import { pool, query, ensureSchema, generateApiKey } from './src/db.js';

async function upsertTenant() {
  const existing = await query('SELECT id FROM tenants WHERE email = $1', [
    env.adminEmail,
  ]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await query(
    `INSERT INTO tenants (name, email, plan, status)
     VALUES ($1, $2, 'pro', 'active') RETURNING id`,
    ['شركة أكمي', env.adminEmail]
  );
  return rows[0].id;
}

async function upsertUser(tenantId) {
  const hash = bcrypt.hashSync(env.adminPassword, 10);
  const existing = await query(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
    [tenantId, env.adminEmail]
  );
  if (existing.rows[0]) {
    await query('UPDATE users SET password_hash = $1, role = $2 WHERE id = $3', [
      hash,
      'tenant_owner',
      existing.rows[0].id,
    ]);
    return existing.rows[0].id;
  }
  const { rows } = await query(
    `INSERT INTO users (tenant_id, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'tenant_owner', 'active') RETURNING id`,
    [tenantId, env.adminEmail, hash]
  );
  return rows[0].id;
}

async function upsertWebsite(tenantId) {
  const domain = 'localhost';
  const existing = await query(
    'SELECT id FROM websites WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1',
    [tenantId]
  );
  if (existing.rows[0]) {
    await query(
      `UPDATE websites SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ knowledgeBaseUrl: DEFAULT_CONFIG.knowledgeBaseUrl }), existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const { rows } = await query(
    `INSERT INTO websites (tenant_id, domain, verified, settings, status)
     VALUES ($1, $2, TRUE, $3, 'active') RETURNING id`,
    [tenantId, domain, DEFAULT_CONFIG]
  );
  return rows[0].id;
}

async function main() {
  await pool.query('SELECT 1');
  await ensureSchema();

  const tenantId = await upsertTenant();
  await upsertUser(tenantId);
  const websiteId = await upsertWebsite(tenantId);

  const { key, hash, prefix } = generateApiKey();
  await query(
    `INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name, scopes, website_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, hash, prefix, 'ويدجت الإنتاج', ['read:assistant'], websiteId]
  );

  const base = env.publicBaseUrl;
  console.log('\n══════════════════════════════════════════════════════');
  console.log(' WBA seed complete');
  console.log('══════════════════════════════════════════════════════');
  console.log(` Dashboard login : ${env.adminEmail} / ${env.adminPassword}`);
  console.log(` API key (save it now — shown once):`);
  console.log(`   ${key}`);
  console.log('\n Paste this on any site (or your Next.js app):');
  console.log(
    `   <script src="${base}/embed.js" data-key="${key}" async></script>`
  );
  console.log('══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch((err) => {
  const msg = err.message || String(err);
  console.error('[seed] failed:', msg || '(no message)');
  if (err.code === 'ECONNREFUSED') {
    console.error('\n  Postgres is not running. Start it from the repo root:');
    console.error('    docker compose up -d postgres\n');
  }
  process.exit(1);
});
