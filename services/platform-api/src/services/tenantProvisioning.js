import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { issueUserToken } from './userDashboard.js';

const ALLOWED_PLANS = ['free', 'starter', 'pro', 'enterprise'];

/**
 * Creates a tenant + owner user. Used by admin panel and public signup.
 */
export async function createTenantAccount({
  name,
  email,
  password,
  plan = 'free',
  createdBy = null,
  notes = null,
}) {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedName = String(name || '').trim();
  const tenantPlan = ALLOWED_PLANS.includes(plan) ? plan : 'free';

  if (!trimmedName || !trimmedEmail || !password) {
    const err = new Error('اسم الشركة والبريد وكلمة المرور مطلوبة');
    err.status = 400;
    throw err;
  }
  if (password.length < 6) {
    const err = new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    err.status = 400;
    throw err;
  }

  const existingTenant = await query('SELECT id FROM tenants WHERE LOWER(email) = $1', [
    trimmedEmail,
  ]);
  if (existingTenant.rows[0]) {
    const err = new Error('يوجد مشترك بهذا البريد بالفعل');
    err.status = 409;
    throw err;
  }

  const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [
    trimmedEmail,
  ]);
  if (existingUser.rows[0]) {
    const err = new Error('يوجد مستخدم بهذا البريد بالفعل');
    err.status = 409;
    throw err;
  }

  const hash = bcrypt.hashSync(password, 10);

  await query('BEGIN');
  try {
    const { rows: tenantRows } = await query(
      `INSERT INTO tenants (name, email, plan, status, created_by, notes)
       VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
      [trimmedName, trimmedEmail, tenantPlan, createdBy, notes || null]
    );
    const tenant = tenantRows[0];

    const { rows: userRows } = await query(
      `INSERT INTO users (tenant_id, email, full_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'tenant_owner', 'active') RETURNING id`,
      [tenant.id, trimmedEmail, trimmedName, hash]
    );
    const userId = userRows[0].id;

    await query('COMMIT');

    const session = await issueUserToken(userId);
    return { tenant, userId, session };
  } catch (err) {
    await query('ROLLBACK');
    if (err.code === '23505') {
      const dup = new Error('البريد مستخدم بالفعل');
      dup.status = 409;
      throw dup;
    }
    throw err;
  }
}
