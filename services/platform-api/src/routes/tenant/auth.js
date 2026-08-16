import bcrypt from 'bcryptjs';
import { query } from '../../db.js';
import { issueUserToken } from '../../services/userDashboard.js';
import { createTenantAccount } from '../../services/tenantProvisioning.js';
import { getPlatformSettings } from '../../services/platformAnalytics.js';
import { getPublicPlans } from '../../services/plans.js';

export function registerAuthRoutes(router) {
  // ─── GET /v1/plans ──────────────────────────────────────────
  router.get('/plans', (_req, res) => {
    res.json(getPublicPlans());
  });

  // ─── POST /v1/auth/signup ───────────────────────────────────
  router.post('/auth/signup', async (req, res, next) => {
    const { name, email, password, plan } = req.body || {};

    try {
      const settings = await getPlatformSettings();
      if (!settings.signupEnabled) {
        return res.status(403).json({ message: 'التسجيل مغلق حالياً — تواصل مع الدعم' });
      }

      const { session } = await createTenantAccount({
        name,
        email,
        password,
        plan: plan || 'free',
      });

      res.status(201).json(session);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      next(err);
    }
  });

  // ─── POST /v1/auth/login ────────────────────────────────────
  router.post('/auth/login', async (req, res, next) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان' });
    }
    try {
      const { rows } = await query(
        `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role, u.status AS user_status,
                u.full_name, t.status AS tenant_status, t.name AS tenant_name, t.plan
           FROM users u
           JOIN tenants t ON t.id = u.tenant_id
          WHERE LOWER(u.email) = LOWER($1)
          LIMIT 1`,
        [email.trim()]
      );
      const user = rows[0];
      if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
      }
      if (user.user_status !== 'active') {
        return res.status(403).json({ message: 'حسابك معلّق — تواصل مع الدعم' });
      }
      if (user.tenant_status !== 'active') {
        return res.status(403).json({ message: 'حساب الشركة معلّق — تواصل مع الدعم' });
      }

      query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]).catch(() => {});

      const session = await issueUserToken(user.id);
      res.json(session);
    } catch (err) {
      next(err);
    }
  });
}
