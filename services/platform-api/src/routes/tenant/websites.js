import { query } from '../../db.js';
import { fullConfig, DEFAULT_CONFIG } from '../../config.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import {
  issueUserToken,
  listTenantWebsites,
  createWebsiteForTenant,
  updateWebsiteDomain,
  ensureWebsiteLinkingKey,
  setWebsiteWidgetEnabled,
} from '../../services/userDashboard.js';
import { assertCanAddWebsite, assertCanEnableWebsiteWidget } from '../../services/plans.js';

export function registerWebsitesRoutes(router) {
  // ─── GET /v1/me/websites ────────────────────────────────────
  router.get('/me/websites', jwtAuth, async (req, res, next) => {
    try {
      const websites = await listTenantWebsites(req.user.tenantId, req.user.websiteId);
      res.json(websites);
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /v1/me/websites ───────────────────────────────────
  router.post('/me/websites', jwtAuth, async (req, res, next) => {
    const { domain, displayName, autoCrawl, crawlFrequency } = req.body || {};
    if (!domain?.trim()) {
      return res.status(400).json({ message: 'النطاق مطلوب' });
    }
    try {
      await assertCanAddWebsite(req.user.tenantId);
      const website = await createWebsiteForTenant(req.user.tenantId, {
        domain,
        displayName,
        autoCrawl,
        crawlFrequency,
      });
      const linking = await ensureWebsiteLinkingKey(req.user.tenantId, website.id);
      const session = await issueUserToken(req.user.userId, website.id);
      res.status(201).json({
        website: { ...website, isActive: true },
        ...session,
        key: linking.key,
        keyPrefix: linking.keyPrefix,
      });
    } catch (err) {
      if (err.status === 403) {
        return res.status(403).json({ message: err.message, code: err.code });
      }
      if (err.status === 400) {
        return res.status(400).json({ message: err.message });
      }
      if (err.code === '23505') {
        return res.status(409).json({ message: 'هذا النطاق مسجّل بالفعل' });
      }
      next(err);
    }
  });

  // ─── PATCH /v1/me/websites/:id ──────────────────────────────
  router.patch('/me/websites/:id', jwtAuth, async (req, res, next) => {
    const { domain, displayName } = req.body || {};
    if (!domain?.trim()) {
      return res.status(400).json({ message: 'النطاق مطلوب' });
    }
    try {
      const website = await updateWebsiteDomain(req.user.tenantId, req.params.id, {
        domain,
        displayName,
      });
      const linking = await ensureWebsiteLinkingKey(req.user.tenantId, website.id);
      res.json({
        website: { ...website, isActive: website.id === req.user.websiteId },
        key: linking.key,
        keyPrefix: linking.keyPrefix,
      });
    } catch (err) {
      if (err.status === 400 || err.status === 404) {
        return res.status(err.status).json({ message: err.message });
      }
      if (err.code === '23505') {
        return res.status(409).json({ message: 'هذا النطاق مسجّل بالفعل' });
      }
      next(err);
    }
  });

  // ─── POST /v1/me/websites/:id/select ────────────────────────
  router.post('/me/websites/:id/select', jwtAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        'SELECT id FROM websites WHERE id = $1 AND tenant_id = $2',
        [req.params.id, req.user.tenantId]
      );
      if (!rows[0]) {
        return res.status(404).json({ message: 'الموقع غير موجود' });
      }
      const session = await issueUserToken(req.user.userId, rows[0].id);
      const linking = await ensureWebsiteLinkingKey(req.user.tenantId, rows[0].id);
      res.json({ ...session, key: linking.key, keyPrefix: linking.keyPrefix });
    } catch (err) {
      next(err);
    }
  });

  // ─── PATCH /v1/me/websites/:id/widget ───────────────────────
  // Toggle widget on the live site (active/inactive). Multiple sites can be active at once.
  router.patch('/me/websites/:id/widget', jwtAuth, async (req, res, next) => {
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled (true/false) مطلوب' });
    }
    try {
      const website = await setWebsiteWidgetEnabled(req.user.tenantId, req.params.id, enabled);
      const websites = await listTenantWebsites(req.user.tenantId, req.user.websiteId);
      res.json({
        website: { ...website, isActive: website.id === req.user.websiteId },
        websites,
        message: enabled
          ? `تم تفعيل الويدجت على ${website.domain}`
          : `تم إيقاف الويدجت على ${website.domain} — لن يعمل كود التضمين`,
      });
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      if (err.status === 404) {
        return res.status(404).json({ message: err.message });
      }
      next(err);
    }
  });

  // ─── POST /v1/me/websites/:id/refresh ───────────────────────
  // Re-check DNS verification (if pending) and return fresh stats.
  router.post('/me/websites/:id/refresh', jwtAuth, async (req, res, next) => {
    try {
      const { refreshWebsiteRecord, getTenantWebsite } = await import('../../services/userDashboard.js');
      const { verifyDomainDns } = await import('../../services/domainVerify.js');

      const { row, mapped } = await refreshWebsiteRecord(req.user.tenantId, req.params.id, {
        activeWebsiteId: req.user.websiteId,
      });

      let verifyResult = { verified: row.verified, skipped: row.verified };

      if (!row.verified && row.verification_token) {
        verifyResult = await verifyDomainDns(row.domain, row.verification_token);
        if (verifyResult.verified) {
          const knowledgeUrl = row.domain.includes(':')
            ? `http://${row.domain}`
            : `https://${row.domain}`;
          const existingKb = String(row.settings?.knowledgeBaseUrl || '').trim();
          const useExisting =
            existingKb &&
            existingKb !== DEFAULT_CONFIG.knowledgeBaseUrl &&
            /^https?:\/\//i.test(existingKb);
          const settings = {
            ...(row.settings || {}),
            knowledgeBaseUrl: useExisting ? existingKb : knowledgeUrl,
          };
          await query(
            `UPDATE websites SET verified = TRUE, status = 'active', settings = $1 WHERE id = $2 AND tenant_id = $3`,
            [settings, row.id, req.user.tenantId]
          );
          verifyResult.message = 'تم التحقق من النطاق بنجاح — الموقع نشط الآن';
        } else if (row.status === 'active') {
          await query(
            `UPDATE websites SET status = 'pending' WHERE id = $1 AND tenant_id = $2 AND verified = FALSE`,
            [row.id, req.user.tenantId]
          );
        }
      } else if (row.verified) {
        verifyResult.message = 'النطاق موثّق مسبقاً';
      }

      const website = await getTenantWebsite(
        req.user.tenantId,
        req.params.id,
        req.user.websiteId
      );

      res.json({
        website,
        verify: verifyResult,
      });
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({ message: err.message });
      }
      next(err);
    }
  });
}
