import { query, hashKey } from '../db.js';

async function assertWebsiteWidgetActive(websiteId) {
  if (!websiteId) {
    return { ok: false, message: 'مفتاح API غير مربوط بموقع' };
  }
  const { rows } = await query(
    'SELECT status, domain FROM websites WHERE id = $1',
    [websiteId]
  );
  const site = rows[0];
  if (!site) {
    return { ok: false, message: 'الموقع المرتبط بالمفتاح غير موجود' };
  }
  if (site.status !== 'active') {
    return {
      ok: false,
      message: `الويدجت متوقف على ${site.domain} — فعّله من صفحة المواقع في لوحة التحكم`,
      code: 'WEBSITE_DISABLED',
    };
  }
  return { ok: true, domain: site.domain };
}

// Resolves an X-API-Key header into the owning tenant + website.
// Attaches req.auth = { tenantId, websiteId, apiKeyId } on success.
export async function apiKeyAuth(req, res, next) {
  const key =
    req.get('X-API-Key') ||
    (req.get('Authorization') || '').replace(/^Bearer\s+/i, '') ||
    req.query.key;

  if (!key) {
    return res.status(401).json({ message: 'مفتاح API مفقود' });
  }

  try {
    const { rows } = await query(
      `SELECT k.id, k.tenant_id, k.website_id, k.revoked,
              w.id AS resolved_website_id
         FROM api_keys k
         LEFT JOIN websites w ON w.tenant_id = k.tenant_id AND w.id = k.website_id
        WHERE k.key_hash = $1
        LIMIT 1`,
      [hashKey(key)]
    );

    const row = rows[0];
    if (!row || row.revoked) {
      return res.status(401).json({ message: 'مفتاح API غير صالح' });
    }

    const websiteId = row.website_id || row.resolved_website_id;
    const siteCheck = await assertWebsiteWidgetActive(websiteId);
    if (!siteCheck.ok) {
      return res.status(403).json({
        message: siteCheck.message,
        code: siteCheck.code || 'WEBSITE_DISABLED',
      });
    }

    req.auth = {
      tenantId: row.tenant_id,
      websiteId,
      apiKeyId: row.id,
    };

    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch(
      () => {}
    );

    next();
  } catch (err) {
    next(err);
  }
}
