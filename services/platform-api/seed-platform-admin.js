/* Seeds the platform admin account for apps/admin login.

   Usage:  npm run seed:platform-admin

   Creates (or updates) one platform_admins row using PLATFORM_ADMIN_EMAIL /
   PLATFORM_ADMIN_PASSWORD from .env (falls back to ADMIN_EMAIL / ADMIN_PASSWORD). */
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool, query, ensureSchema } from './src/db.js';

const email = (process.env.PLATFORM_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@wba.local').trim();
const password = process.env.PLATFORM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin1234';
const fullName = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

async function main() {
  await pool.query('SELECT 1');
  await ensureSchema();

  // Apply MVP migration if this DB was created before 002 existed.
  const { rows: adminTable } = await query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'platform_admins'`
  );
  if (!adminTable.length) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'database', 'schemas', '002-mvp-admin-user-flow.sql'),
      'utf8'
    );
    await query(sql);
    console.log('[seed:platform-admin] Applied 002-mvp-admin-user-flow.sql');
  }

  const hash = bcrypt.hashSync(password, 10);
  const existing = await query('SELECT id FROM platform_admins WHERE LOWER(email) = LOWER($1)', [email]);

  if (existing.rows[0]) {
    await query(
      `UPDATE platform_admins SET password_hash = $1, full_name = $2, status = 'active' WHERE id = $3`,
      [hash, fullName, existing.rows[0].id]
    );
  } else {
    await query(
      `INSERT INTO platform_admins (email, password_hash, full_name, status)
       VALUES ($1, $2, $3, 'active')`,
      [email, hash, fullName]
    );
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(' Platform admin seed complete');
  console.log('══════════════════════════════════════════════════════');
  console.log(` Admin panel login : ${email} / ${password}`);
  console.log(' Open apps/admin and use these credentials.');
  console.log('══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch((err) => {
  console.error('[seed:platform-admin] failed:', err.message || err);
  process.exit(1);
});
