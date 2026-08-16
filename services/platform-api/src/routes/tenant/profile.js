import bcrypt from 'bcryptjs';
import { query } from '../../db.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import {
  issueUserToken,
  listTenantWebsites,
  fetchUserRecord,
} from '../../services/userDashboard.js';
import {
  getTenantUsage,
  updateTenantPlan,
  normalizePlan,
  PLAN_ORDER,
  formatPlanEnforcementMessage,
} from '../../services/plans.js';
import { getTenantAnalytics } from '../../services/tenantAnalytics.js';

export function registerProfileRoutes(router) {
  // ─── GET /v1/me/profile ─────────────────────────────────────
  router.get('/me/profile', jwtAuth, async (req, res, next) => {
    try {
      const websites = await listTenantWebsites(req.user.tenantId, req.user.websiteId);
      const usage = await getTenantUsage(req.user.tenantId, req.user.websiteId);
      res.json({
        user: req.user,
        websites,
        hasWebsite: websites.length > 0,
        usage,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/usage ───────────────────────────────────────
  router.get('/me/usage', jwtAuth, async (req, res, next) => {
    try {
      const usage = await getTenantUsage(req.user.tenantId, req.user.websiteId);
      res.json(usage);
    } catch (err) {
      next(err);
    }
  });

  // ─── PATCH /v1/me/plan ──────────────────────────────────────
  router.patch('/me/plan', jwtAuth, async (req, res, next) => {
    const { plan } = req.body || {};
    if (!plan || !PLAN_ORDER.includes(normalizePlan(plan))) {
      return res.status(400).json({ message: 'باقة غير صالحة' });
    }
    if (!['tenant_owner', 'tenant_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية تغيير الباقة' });
    }
    try {
      const limits = await updateTenantPlan(req.user.tenantId, plan);
      const session = await issueUserToken(req.user.userId, req.user.websiteId);
      const usage = await getTenantUsage(req.user.tenantId, req.user.websiteId);
      res.json({
        ...session,
        usage,
        message: formatPlanEnforcementMessage(limits, limits.enforcement),
      });
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({ message: err.message });
      }
      next(err);
    }
  });

  // ─── GET /v1/me/overview ────────────────────────────────────
  router.get('/me/overview', jwtAuth, async (req, res, next) => {
    try {
      const websiteId = req.user.websiteId || null;
      const { rows: stats } = await query(
        `SELECT
           (SELECT COUNT(*)::int FROM websites WHERE tenant_id = $1) AS websites,
           (SELECT COUNT(*)::int FROM sessions
              WHERE tenant_id = $1
                AND ($2::uuid IS NULL OR website_id = $2)
                AND started_at >= CURRENT_DATE) AS queries_today,
           (SELECT COUNT(*)::int FROM sessions
              WHERE tenant_id = $1
                AND ($2::uuid IS NULL OR website_id = $2)
                AND started_at >= NOW() - INTERVAL '7 days') AS queries_week,
           (SELECT COUNT(*)::int FROM documents
              WHERE tenant_id = $1 AND ($2::uuid IS NULL OR website_id = $2)) AS documents,
           (SELECT COUNT(*)::int FROM sessions
              WHERE tenant_id = $1 AND ($2::uuid IS NULL OR website_id = $2)) AS total_conversations`,
        [req.user.tenantId, websiteId]
      );
      const websites = await listTenantWebsites(req.user.tenantId, req.user.websiteId);
      const active = websites.find((w) => w.isActive) || websites[0] || null;

      res.json({
        ...stats[0],
        activeWebsite: active
          ? { id: active.id, domain: active.domain, name: active.name, status: active.status }
          : null,
        websites: websites.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/analytics ───────────────────────────────────
  router.get('/me/analytics', jwtAuth, async (req, res, next) => {
    const period = req.query.period || '30d';
    if (!['7d', '30d', '90d'].includes(period)) {
      return res.status(400).json({ message: 'فترة غير صالحة — استخدم 7d أو 30d أو 90d' });
    }
    try {
      const analytics = await getTenantAnalytics(
        req.user.tenantId,
        req.user.websiteId || null,
        period
      );
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/settings ────────────────────────────────────
  router.get('/me/settings', jwtAuth, async (req, res, next) => {
    try {
      const user = await fetchUserRecord(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'المستخدم غير موجود' });
      }
      res.json({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tenantName: user.tenant_name,
        plan: user.plan,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── PATCH /v1/me/settings ──────────────────────────────────
  router.patch('/me/settings', jwtAuth, async (req, res, next) => {
    const { fullName } = req.body || {};
    if (!fullName?.trim()) {
      return res.status(400).json({ message: 'الاسم الكامل مطلوب' });
    }
    try {
      await query('UPDATE users SET full_name = $1 WHERE id = $2', [
        fullName.trim(),
        req.user.userId,
      ]);
      const user = await fetchUserRecord(req.user.userId);
      res.json({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tenantName: user.tenant_name,
        plan: user.plan,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── PATCH /v1/me/password ──────────────────────────────────
  router.patch('/me/password', jwtAuth, async (req, res, next) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
    }
    try {
      const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [
        req.user.userId,
      ]);
      const user = rows[0];
      if (!user?.password_hash || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة' });
      }
      const passwordHash = bcrypt.hashSync(newPassword, 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        req.user.userId,
      ]);
      res.json({ ok: true, message: 'تم تحديث كلمة المرور' });
    } catch (err) {
      next(err);
    }
  });
}
