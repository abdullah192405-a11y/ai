/* Creates a subscriber account WITHOUT a website — for testing the MVP flow:
   admin gives credentials → user logs in → user adds domain themselves.

   Usage:  npm run seed:tenant-user

   Env (optional):
     TENANT_USER_EMAIL=user@example.com
     TENANT_USER_PASSWORD=changeme123
     TENANT_NAME=Example Corp */
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool, query, ensureSchema } from './src/db.js';

const email = (process.env.TENANT_USER_EMAIL || 'user@example.com').trim();
const password = process.env.TENANT_USER_PASSWORD || 'changeme123';
const tenantName = process.env.TENANT_NAME || 'Example Corp';

async function main() {
  await pool.query('SELECT 1');
  await ensureSchema();

  const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rows[0]) {
    console.log(`[seed:tenant-user] User already exists: ${email}`);
    await pool.end();
    return;
  }

  const admin = await query('SELECT id FROM platform_admins ORDER BY created_at ASC LIMIT 1');
  const createdBy = admin.rows[0]?.id || null;

  const hash = bcrypt.hashSync(password, 10);

  await query('BEGIN');
  try {
    const { rows: tenantRows } = await query(
      `INSERT INTO tenants (name, email, plan, status, created_by)
       VALUES ($1, $2, 'free', 'active', $3) RETURNING id`,
      [tenantName, email, createdBy]
    );
    const tenantId = tenantRows[0].id;

    await query(
      `INSERT INTO users (tenant_id, email, full_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'tenant_owner', 'active')`,
      [tenantId, email, tenantName, hash]
    );

    await query('COMMIT');

    console.log('\n══════════════════════════════════════════════════════');
    console.log(' Tenant user seed complete (no website yet)');
    console.log('══════════════════════════════════════════════════════');
    console.log(` User dashboard login : ${email} / ${password}`);
    console.log(' After login → Websites → register a domain');
    console.log('══════════════════════════════════════════════════════\n');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[seed:tenant-user] failed:', err.message || err);
  process.exit(1);
});
