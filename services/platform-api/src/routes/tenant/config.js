import { query } from '../../db.js';
import { fullConfig, DEFAULT_CONFIG } from '../../config.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import { requireWebsite } from '../../services/userDashboard.js';

export function registerConfigRoutes(router) {
  // ─── GET /v1/me/config ──────────────────────────────────────
  router.get('/me/config', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [
        req.user.websiteId,
      ]);
      res.json(fullConfig(rows[0]?.settings || {}));
    } catch (err) {
      next(err);
    }
  });

  // ─── PUT /v1/me/config ──────────────────────────────────────
  router.put('/me/config', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      // Only persist known keys; ignore anything unexpected.
      const incoming = req.body || {};
      const updates = {};
      for (const key of Object.keys(DEFAULT_CONFIG)) {
        if (key in incoming) updates[key] = incoming[key];
      }
      const current = await query('SELECT settings FROM websites WHERE id = $1', [
        req.user.websiteId,
      ]);
      const merged = { ...(current.rows[0]?.settings || {}), ...updates };
      await query('UPDATE websites SET settings = $1 WHERE id = $2', [
        merged,
        req.user.websiteId,
      ]);
      res.json(fullConfig(merged));
    } catch (err) {
      next(err);
    }
  });
}
