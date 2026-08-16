import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { adminAuth, signAdminToken } from '../middleware/adminAuth.js';
import { normalizePlan, PLAN_ORDER, updateTenantPlan, formatPlanEnforcementMessage } from '../services/plans.js';
import { formatDateAr as formatDate } from '../utils/dates.js';
import {
  getProviderKeysStatus,
  updateProviderKeys,
} from '../services/platformConfig.js';
import {
  revokeAdminApiKey,
  rotateAdminApiKey,
  updateAdminApiKey,
} from '../services/adminApiKeys.js';
import {
  getPlatformOverview,
  getRevenueHistory,
  getSystemHealth,
  getSystemEvents,
  getAiModelsStats,
  getPlatformApiKeys,
  getCrawlJobs,
  getAuditLog,
  getSupportTickets,
  getModerationQueue,
  getAnnouncements,
  getPlatformSettings,
  getSystemCharts,
} from '../services/platformAnalytics.js';

export const platformAdminRouter = express.Router();

const PLAN_LABELS = {
  free: 'مجاني',
  starter: 'مبتدئ',
  pro: 'احترافي',
  enterprise: 'مؤسسي',
};

function roleLabel(role) {
  const map = {
    tenant_owner: 'مالك',
    tenant_admin: 'مدير',
    tenant_editor: 'محرر',
    tenant_viewer: 'عارض',
  };
  return map[role] || role;
}

// ─── POST /v1/admin/auth/login ──────────────────────────────
platformAdminRouter.post('/auth/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان' });
  }
  try {
    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, status
         FROM platform_admins WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );
    const admin = rows[0];
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }
    if (!bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    query('UPDATE platform_admins SET last_login_at = NOW() WHERE id = $1', [admin.id]).catch(
      () => {}
    );

    const user = {
      adminId: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      type: 'platform_admin',
    };
    res.json({ token: signAdminToken(admin), user });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/tenants ──────────────────────────────────
platformAdminRouter.get('/tenants', adminAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         t.id, t.name, t.email, t.plan, t.status, t.notes, t.created_at,
         (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) AS user_count,
         (SELECT COUNT(*)::int FROM websites w WHERE w.tenant_id = t.id) AS website_count,
         (SELECT w.domain FROM websites w WHERE w.tenant_id = t.id ORDER BY w.created_at ASC LIMIT 1) AS primary_domain,
         (SELECT u.last_login_at FROM users u WHERE u.tenant_id = t.id ORDER BY u.last_login_at DESC NULLS LAST LIMIT 1) AS last_login_at
       FROM tenants t
       ORDER BY t.created_at DESC`
    );

    res.json(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        plan: t.plan,
        planLabel: PLAN_LABELS[t.plan] || t.plan,
        status: t.status,
        notes: t.notes,
        domain: t.primary_domain || '—',
        users: t.user_count,
        websites: t.website_count,
        createdAt: t.created_at,
        createdLabel: formatDate(t.created_at),
        lastActive: formatDate(t.last_login_at),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/admin/tenants ─────────────────────────────────
// Creates tenant + owner user (no website — user adds domain later).
platformAdminRouter.post('/tenants', adminAuth, async (req, res, next) => {
  const { name, email, password, plan, notes } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedName = (name || '').trim();

  if (!trimmedName || !trimmedEmail || !password) {
    return res.status(400).json({ message: 'اسم الشركة والبريد وكلمة المرور مطلوبة' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  }

  const allowedPlans = ['free', 'starter', 'pro', 'enterprise'];
  const tenantPlan = allowedPlans.includes(plan) ? plan : 'free';

  try {
    const existingTenant = await query('SELECT id FROM tenants WHERE LOWER(email) = $1', [
      trimmedEmail,
    ]);
    if (existingTenant.rows[0]) {
      return res.status(409).json({ message: 'يوجد مشترك بهذا البريد بالفعل' });
    }

    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [
      trimmedEmail,
    ]);
    if (existingUser.rows[0]) {
      return res.status(409).json({ message: 'يوجد مستخدم بهذا البريد بالفعل' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const adminId = req.admin.adminId;

    await query('BEGIN');
    try {
      const { rows: tenantRows } = await query(
        `INSERT INTO tenants (name, email, plan, status, created_by, notes)
         VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
        [trimmedName, trimmedEmail, tenantPlan, adminId, notes || null]
      );
      const tenant = tenantRows[0];

      const { rows: userRows } = await query(
        `INSERT INTO users (tenant_id, email, full_name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'tenant_owner', 'active') RETURNING id, email, full_name, role, status, created_at`,
        [tenant.id, trimmedEmail, trimmedName, hash]
      );
      const user = userRows[0];

      await query(
        `INSERT INTO audit_logs (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
         VALUES ($1, 'platform_admin', $2, 'tenant.created', 'tenant', $1, $3)`,
        [tenant.id, adminId, JSON.stringify({ email: trimmedEmail, plan: tenantPlan })]
      );

      await query('COMMIT');

      res.status(201).json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          plan: tenant.plan,
          planLabel: PLAN_LABELS[tenant.plan],
          status: tenant.status,
          createdAt: tenant.created_at,
        },
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          roleLabel: roleLabel(user.role),
        },
        credentials: { email: trimmedEmail, password },
      });
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'البريد مستخدم بالفعل' });
    }
    next(err);
  }
});

// ─── GET /v1/admin/users ────────────────────────────────────
platformAdminRouter.get('/users', adminAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         u.id, u.email, u.full_name, u.role, u.status, u.last_login_at, u.created_at,
         t.id AS tenant_id, t.name AS tenant_name, t.plan AS tenant_plan, t.status AS tenant_status
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       ORDER BY u.created_at DESC`
    );

    res.json(
      rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.full_name || u.email,
        role: u.role,
        roleLabel: roleLabel(u.role),
        status: u.status,
        tenantId: u.tenant_id,
        tenant: u.tenant_name,
        tenantPlan: u.tenant_plan,
        tenantStatus: u.tenant_status,
        lastLogin: formatDate(u.last_login_at),
        created: formatDate(u.created_at),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /v1/admin/users/:id/status ───────────────────────
platformAdminRouter.patch('/users/:id/status', adminAuth, async (req, res, next) => {
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'حالة غير صالحة' });
  }
  try {
    const { rows } = await query(
      `UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, status`,
      [status, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /v1/admin/users/:id/password ───────────────────────
platformAdminRouter.patch('/users/:id/password', adminAuth, async (req, res, next) => {
  let { password } = req.body || {};
  if (!password) {
    password = crypto.randomBytes(6).toString('base64url').slice(0, 10);
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'كلمة المرور قصيرة جداً' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email`,
      [hash, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({ ...rows[0], password });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /v1/admin/tenants/:id/plan ───────────────────────
platformAdminRouter.patch('/tenants/:id/plan', adminAuth, async (req, res, next) => {
  const { plan } = req.body || {};
  if (!plan || !PLAN_ORDER.includes(normalizePlan(plan))) {
    return res.status(400).json({ message: 'باقة غير صالحة' });
  }
  try {
    const { rows: before } = await query('SELECT plan FROM tenants WHERE id = $1', [req.params.id]);
    if (!before[0]) {
      return res.status(404).json({ message: 'المشترك غير موجود' });
    }
    const limits = await updateTenantPlan(req.params.id, plan);
    await query(
      `INSERT INTO audit_logs (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'platform_admin', $2, 'tenant.plan_changed', 'tenant', $1, $3)`,
      [
        req.params.id,
        req.admin.adminId,
        JSON.stringify({
          from: before[0].plan,
          to: limits.id,
          deactivatedWebsites: limits.enforcement?.websites?.deactivated || [],
          revokedApiKeys: limits.enforcement?.apiKeys?.revoked || [],
        }),
      ]
    );
    res.json({
      id: req.params.id,
      plan: limits.id,
      planLabel: limits.label,
      enforcement: limits.enforcement,
      message: formatPlanEnforcementMessage(limits, limits.enforcement),
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
});

// ─── PATCH /v1/admin/tenants/:id/status ───────────────────────
platformAdminRouter.patch('/tenants/:id/status', adminAuth, async (req, res, next) => {
  const { status } = req.body || {};
  if (!['active', 'suspended', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'حالة غير صالحة' });
  }
  try {
    const { rows } = await query(
      `UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status`,
      [status, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'المشترك غير موجود' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/overview', adminAuth, async (_req, res, next) => {
  try {
    res.json(await getPlatformOverview());
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/revenue', adminAuth, async (_req, res, next) => {
  try {
    const [revenueHistory, overview] = await Promise.all([getRevenueHistory(), getPlatformOverview()]);
    res.json({ revenueHistory, planDistribution: overview.planDistribution, platformKPIs: overview.platformKPIs });
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/system', adminAuth, async (_req, res, next) => {
  try {
    const [systemHealth, systemEvents, charts] = await Promise.all([
      getSystemHealth(),
      getSystemEvents(),
      getSystemCharts(),
    ]);
    res.json({ systemHealth, systemEvents, ...charts });
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/ai-models', adminAuth, async (_req, res, next) => {
  try {
    res.json(await getAiModelsStats());
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/ai-models/keys', adminAuth, async (_req, res) => {
  res.json(getProviderKeysStatus());
});

platformAdminRouter.patch('/ai-models/keys', adminAuth, async (req, res, next) => {
  try {
    const { groqApiKey, geminiApiKey, aiProvider } = req.body || {};
    res.json(
      await updateProviderKeys({
        groqApiKey,
        geminiApiKey,
        aiProvider,
        adminId: req.admin.adminId,
      })
    );
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/api-keys', adminAuth, async (_req, res, next) => {
  try {
    res.json(await getPlatformApiKeys());
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.patch('/api-keys/:id', adminAuth, async (req, res, next) => {
  try {
    res.json(await updateAdminApiKey(req.params.id, req.body || {}));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

platformAdminRouter.post('/api-keys/:id/revoke', adminAuth, async (req, res, next) => {
  try {
    res.json(await revokeAdminApiKey(req.params.id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

platformAdminRouter.post('/api-keys/:id/rotate', adminAuth, async (req, res, next) => {
  try {
    res.json(await rotateAdminApiKey(req.params.id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

platformAdminRouter.get('/crawl-jobs', adminAuth, async (_req, res, next) => {
  try {
    res.json({ jobs: await getCrawlJobs() });
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/audit-log', adminAuth, async (_req, res, next) => {
  try {
    res.json({ entries: await getAuditLog() });
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/moderation', adminAuth, async (_req, res, next) => {
  try {
    res.json(await getModerationQueue());
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/support', adminAuth, async (_req, res, next) => {
  try {
    res.json(await getSupportTickets());
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/announcements', adminAuth, async (_req, res, next) => {
  try {
    res.json({ announcements: await getAnnouncements() });
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/settings', adminAuth, async (_req, res, next) => {
  try {
    res.json(await getPlatformSettings());
  } catch (err) {
    next(err);
  }
});
