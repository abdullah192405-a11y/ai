import { query, generateApiKey } from '../../db.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import { requireWebsite } from '../../services/userDashboard.js';
import { assertCanCreateApiKey } from '../../services/plans.js';

export function registerKeysRoutes(router) {
  // ─── GET /v1/me/keys ────────────────────────────────────────
  router.get('/me/keys', jwtAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT k.id, k.key_prefix, k.name, k.scopes, k.revoked, k.last_used_at, k.created_at,
                k.website_id, w.domain AS website_domain, w.status AS website_status
           FROM api_keys k
           LEFT JOIN websites w ON w.id = k.website_id
          WHERE k.tenant_id = $1
          ORDER BY k.created_at DESC`,
        [req.user.tenantId]
      );
      res.json(
        rows.map((k) => ({
          ...k,
          widgetActive: k.website_status === 'active',
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /v1/me/keys ───────────────────────────────────────
  // Creates a key and returns the plaintext once.
  router.post('/me/keys', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      await assertCanCreateApiKey(req.user.tenantId);
      const { name, scopes } = req.body || {};
      const { key, hash, prefix } = generateApiKey();
      const { rows } = await query(
        `INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name, scopes, website_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, key_prefix, name, scopes, revoked, last_used_at, created_at`,
        [
          req.user.tenantId,
          hash,
          prefix,
          name || 'مفتاح جديد',
          Array.isArray(scopes) && scopes.length ? scopes : ['read:assistant'],
          req.user.websiteId,
        ]
      );
      res.status(201).json({ ...rows[0], key });
    } catch (err) {
      if (err.status === 403) {
        return res.status(403).json({ message: err.message, code: err.code });
      }
      next(err);
    }
  });

  // ─── DELETE /v1/me/keys/:id ─────────────────────────────────
  router.delete('/me/keys/:id', jwtAuth, async (req, res, next) => {
    try {
      await query('UPDATE api_keys SET revoked = TRUE WHERE id = $1 AND tenant_id = $2', [
        req.params.id,
        req.user.tenantId,
      ]);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
}
