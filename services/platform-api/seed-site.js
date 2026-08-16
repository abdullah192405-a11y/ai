/* Seeds an additional tenant + admin user + website + API key.

   Usage:
     npm run seed:site
     SITE_EMAIL=... SITE_PASSWORD=... SITE_NAME=... SITE_KNOWLEDGE_URL=... npm run seed:site

   Safe to re-run: tenant/user/website are upserted; a NEW API key is issued each run. */
import bcrypt from 'bcryptjs';
import { env, DEFAULT_CONFIG } from './src/config.js';
import { pool, query, ensureSchema, generateApiKey } from './src/db.js';

const siteEmail = process.env.SITE_EMAIL || 'admin@site3000.com';
const sitePassword = process.env.SITE_PASSWORD || 'admin1234';
const siteName = process.env.SITE_NAME || 'موقع 3000';
const knowledgeBaseUrl =
  process.env.SITE_KNOWLEDGE_URL || 'http://localhost:3000';

const siteConfig = {
  ...DEFAULT_CONFIG,
  knowledgeBaseUrl,
  botName: 'مساعد الموقع',
  welcomeMessage: 'مرحباً! 👋 أنا مساعد هذا الموقع. اسألني عن أي شيء.',
};

async function upsertTenant() {
  const existing = await query('SELECT id FROM tenants WHERE email = $1', [siteEmail]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await query(
    `INSERT INTO tenants (name, email, plan, status)
     VALUES ($1, $2, 'pro', 'active') RETURNING id`,
    [siteName, siteEmail]
  );
  return rows[0].id;
}

async function upsertUser(tenantId) {
  const hash = bcrypt.hashSync(sitePassword, 10);
  const existing = await query(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
    [tenantId, siteEmail]
  );
  if (existing.rows[0]) {
    await query('UPDATE users SET password_hash = $1, role = $2 WHERE id = $3', [
      hash,
      'owner',
      existing.rows[0].id,
    ]);
    return existing.rows[0].id;
  }
  const { rows } = await query(
    `INSERT INTO users (tenant_id, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'owner', 'active') RETURNING id`,
    [tenantId, siteEmail, hash]
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
      [JSON.stringify({ knowledgeBaseUrl }), existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const { rows } = await query(
    `INSERT INTO websites (tenant_id, domain, verified, settings, status)
     VALUES ($1, $2, TRUE, $3, 'active') RETURNING id`,
    [tenantId, domain, siteConfig]
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
    [tenantId, hash, prefix, 'ويدجت localhost:3000', ['read:assistant'], websiteId]
  );

  const base = env.publicBaseUrl;
  console.log('\n══════════════════════════════════════════════════════');
  console.log(' WBA site seed complete');
  console.log('══════════════════════════════════════════════════════');
  console.log(` Site            : ${knowledgeBaseUrl}`);
  console.log(` Dashboard login : ${siteEmail} / ${sitePassword}`);
  console.log(` API key (save it now — shown once):`);
  console.log(`   ${key}`);
  console.log('\n Paste this on http://localhost:3000:');
  console.log(
    `   <script src="${base}/embed.js" data-key="${key}" async></script>`
  );
  console.log('══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch((err) => {
  const msg = err.message || String(err);
  console.error('[seed-site] failed:', msg || '(no message)');
  if (err.code === 'ECONNREFUSED') {
    console.error('\n  Postgres is not running. Start it from the repo root:');
    console.error('    docker compose up -d postgres\n');
  }
  process.exit(1);
});
