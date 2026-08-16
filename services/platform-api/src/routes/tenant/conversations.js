import { query } from '../../db.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';

export function registerConversationsRoutes(router) {
  // ─── GET /v1/me/conversations ───────────────────────────────
  // Lightweight backing for the dashboard Conversations page.
  router.get('/me/conversations', jwtAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT s.id, s.visitor_id, s.page_url, s.message_count, s.started_at, s.last_active_at,
                (SELECT content FROM messages m
                  WHERE m.session_id = s.id AND m.role = 'user'
                  ORDER BY m.created_at DESC LIMIT 1) AS preview,
                (SELECT COUNT(*)::int FROM messages m WHERE m.session_id = s.id) AS total_messages
           FROM sessions s
          WHERE s.tenant_id = $1
            AND ($2::uuid IS NULL OR s.website_id = $2)
          ORDER BY s.last_active_at DESC
          LIMIT 50`,
        [req.user.tenantId, req.user.websiteId || null]
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/conversations/:id/messages ──────────────────
  router.get('/me/conversations/:id/messages', jwtAuth, async (req, res, next) => {
    try {
      const { rows: sessionRows } = await query(
        `SELECT id FROM sessions
          WHERE id = $1 AND tenant_id = $2
            AND ($3::uuid IS NULL OR website_id = $3)`,
        [req.params.id, req.user.tenantId, req.user.websiteId || null]
      );
      if (!sessionRows[0]) {
        return res.status(404).json({ message: 'الجلسة غير موجودة' });
      }

      const { rows } = await query(
        `SELECT id, role, content, page_url, model_used, latency_ms, created_at
           FROM messages
          WHERE session_id = $1
          ORDER BY created_at ASC`,
        [req.params.id]
      );
      res.json({ messages: rows });
    } catch (err) {
      next(err);
    }
  });
}
