import crypto from 'node:crypto';
import { query, generateApiKey } from '../db.js';
import { DEFAULT_CONFIG } from '../config.js';
import { signToken } from '../middleware/jwtAuth.js';
import { formatDateAr } from '../utils/dates.js';
import { assertCanEnableWebsiteWidget } from './plans.js';

export { formatDateAr };

export function normalizeDomain(raw) {
  let d = String(raw || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/^www\./, '');
  return d;
}

/** True for production domains and local dev hosts (localhost, 127.0.0.1 + optional port). */
export function isValidDomain(d) {
  if (!d) return false;
  if (/^localhost(?::\d{1,5})?$/.test(d)) return true;
  if (/^127(?:\.\d{1,3}){3}(?::\d{1,5})?$/.test(d)) return true;
  if (/^0\.0\.0\.0(?::\d{1,5})?$/.test(d)) return true;
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(d)) {
    return true;
  }
  return false;
}

export function isLocalDevDomain(d) {
  return (
    /^localhost(?::\d{1,5})?$/.test(d) ||
    /^127(?:\.\d{1,3}){3}(?::\d{1,5})?$/.test(d) ||
    /^0\.0\.0\.0(?::\d{1,5})?$/.test(d)
  );
}

const CRAWL_LABELS = {
  hourly: 'كل ساعة',
  daily: 'يومي',
  weekly: 'أسبوعي',
  manual: 'يدوي فقط',
};

export async function fetchUserRecord(userId) {
  const { rows } = await query(
    `SELECT u.id, u.tenant_id, u.email, u.full_name, u.role, u.status AS user_status,
            t.name AS tenant_name, t.plan, t.status AS tenant_status
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export function userPayload(user, websiteId) {
  return {
    userId: user.id,
    tenantId: user.tenant_id,
    websiteId: websiteId || null,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    tenantName: user.tenant_name,
    plan: user.plan,
  };
}

export async function issueUserToken(userId, websiteId = null) {
  const user = await fetchUserRecord(userId);
  if (!user) return null;
  if (websiteId) {
    const { rows } = await query(
      'SELECT id FROM websites WHERE id = $1 AND tenant_id = $2',
      [websiteId, user.tenant_id]
    );
    if (!rows[0]) websiteId = null;
  }
  if (!websiteId) {
    const { rows } = await query(
      'SELECT id FROM websites WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1',
      [user.tenant_id]
    );
    websiteId = rows[0]?.id || null;
  }
  return {
    token: signToken(userPayload(user, websiteId)),
    user: userPayload(user, websiteId),
  };
}

export async function mapWebsiteRow(row) {
  return {
    id: row.id,
    domain: row.domain,
    name: row.display_name || row.domain,
    displayName: row.display_name,
    status: row.status,
    verified: row.verified,
    verificationToken: row.verification_token,
    autoCrawl: row.auto_crawl,
    crawlFrequency: row.crawl_frequency,
    crawlFrequencyLabel: CRAWL_LABELS[row.crawl_frequency] || row.crawl_frequency,
    createdAt: row.created_at,
    createdLabel: formatDateAr(row.created_at),
    documents: Number(row.documents || 0),
    pagesCrawled: Number(row.pages_crawled || 0),
    queriesToday: Number(row.queries_today || 0),
    queriesWeek: Number(row.queries_week || 0),
    lastCrawled: row.last_crawled ? formatDateAr(row.last_crawled) : '—',
    /** Widget live on visitor site (status === active). */
    widgetEnabled: row.status === 'active',
    isActive: false,
  };
}

export async function listTenantWebsites(tenantId, activeWebsiteId) {
  const { rows } = await query(
    `SELECT w.*,
            (SELECT COUNT(*)::int FROM documents d WHERE d.website_id = w.id) AS documents,
            (SELECT COUNT(*)::int FROM indexed_pages ip WHERE ip.website_id = w.id) AS pages_crawled,
            (SELECT COUNT(*)::int FROM sessions s
              WHERE s.website_id = w.id AND s.started_at >= CURRENT_DATE) AS queries_today,
            (SELECT COUNT(*)::int FROM sessions s
              WHERE s.website_id = w.id AND s.started_at >= NOW() - INTERVAL '7 days') AS queries_week,
            (SELECT MAX(crawled_at) FROM indexed_pages ip WHERE ip.website_id = w.id) AS last_crawled
       FROM websites w
      WHERE w.tenant_id = $1
      ORDER BY w.created_at ASC`,
    [tenantId]
  );
  const mapped = await Promise.all(rows.map(mapWebsiteRow));
  return mapped.map((w) => ({ ...w, isActive: w.id === activeWebsiteId }));
}

export function requireWebsite(req, res, next) {
  if (!req.user?.websiteId) {
    return res.status(400).json({
      message: 'أضف موقعاً أولاً من صفحة المواقع',
      code: 'NO_WEBSITE',
    });
  }
  next();
}

export async function createWebsiteForTenant(tenantId, { domain, displayName, autoCrawl, crawlFrequency }) {
  const normalized = normalizeDomain(domain);
  if (!isValidDomain(normalized)) {
    throw Object.assign(
      new Error('نطاق غير صالح — مثال: example.com أو localhost:5173'),
      { status: 400 }
    );
  }

  const localDev = isLocalDevDomain(normalized);
  const verificationToken = localDev
    ? null
    : `wba-verify-${crypto.randomBytes(12).toString('hex')}`;
  const freq = ['hourly', 'daily', 'weekly', 'manual'].includes(crawlFrequency)
    ? crawlFrequency
    : 'daily';

  const knowledgeUrl = localDev ? `http://${normalized}` : `https://${normalized}`;
  const settings = {
    ...DEFAULT_CONFIG,
    knowledgeBaseUrl: knowledgeUrl,
  };

  const { rows } = await query(
    `INSERT INTO websites (
       tenant_id, domain, display_name, verified, verification_token,
       auto_crawl, crawl_frequency, settings, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tenantId,
      normalized,
      displayName?.trim() || normalized,
      localDev,
      verificationToken,
      Boolean(autoCrawl),
      freq,
      settings,
      localDev ? 'active' : 'pending',
    ]
  );
  return mapWebsiteRow(rows[0]);
}

export async function updateWebsiteDomain(tenantId, websiteId, { domain, displayName }) {
  const { rows: existingRows } = await query(
    'SELECT * FROM websites WHERE id = $1 AND tenant_id = $2',
    [websiteId, tenantId]
  );
  const row = existingRows[0];
  if (!row) {
    throw Object.assign(new Error('الموقع غير موجود'), { status: 404 });
  }

  const normalized = normalizeDomain(domain);
  if (!isValidDomain(normalized)) {
    throw Object.assign(
      new Error('نطاق غير صالح — مثال: example.com أو localhost:5173'),
      { status: 400 }
    );
  }

  const name = displayName?.trim() || row.display_name || normalized;
  const domainChanged = normalized !== row.domain;

  if (!domainChanged) {
    const { rows } = await query(
      `UPDATE websites SET display_name = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [name, websiteId, tenantId]
    );
    return mapWebsiteRow(rows[0]);
  }

  const localDev = isLocalDevDomain(normalized);
  const verificationToken = localDev
    ? null
    : `wba-verify-${crypto.randomBytes(12).toString('hex')}`;
  const knowledgeUrl = localDev
    ? `http://${normalized}`
    : `https://${normalized}`;
  const settings = {
    ...(row.settings || {}),
    knowledgeBaseUrl: knowledgeUrl,
  };

  const { rows } = await query(
    `UPDATE websites SET
       domain = $1,
       display_name = $2,
       verified = $3,
       verification_token = $4,
       status = $5,
       settings = $6
     WHERE id = $7 AND tenant_id = $8
     RETURNING *`,
    [
      normalized,
      name,
      localDev,
      verificationToken,
      localDev ? 'active' : 'pending',
      settings,
      websiteId,
      tenantId,
    ]
  );
  return mapWebsiteRow(rows[0]);
}

/** Point every live linking key at the selected website. */
export async function bindLiveKeysToWebsite(tenantId, websiteId) {
  await query(
    `UPDATE api_keys SET website_id = $1
      WHERE tenant_id = $2 AND NOT revoked`,
    [websiteId, tenantId]
  );
}

/**
 * Ensure the selected website has a linking key.
 * Rebinds existing live keys; creates one only if the tenant has none.
 */
export async function ensureWebsiteLinkingKey(tenantId, websiteId) {
  await bindLiveKeysToWebsite(tenantId, websiteId);
  const { rows } = await query(
    `SELECT id, key_prefix FROM api_keys
      WHERE tenant_id = $1 AND website_id = $2 AND NOT revoked
      ORDER BY created_at ASC
      LIMIT 1`,
    [tenantId, websiteId]
  );
  if (rows[0]) {
    return { created: false, key: null, keyPrefix: rows[0].key_prefix };
  }
  const { key, hash, prefix } = generateApiKey();
  await query(
    `INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name, scopes, website_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, hash, prefix, 'مفتاح الربط', ['read:assistant'], websiteId]
  );
  return { created: true, key, keyPrefix: prefix };
}

export async function getTenantWebsite(tenantId, websiteId, activeWebsiteId) {
  const websites = await listTenantWebsites(tenantId, activeWebsiteId);
  return websites.find((w) => w.id === websiteId) || null;
}

export async function refreshWebsiteRecord(tenantId, websiteId, { activeWebsiteId } = {}) {
  const { rows } = await query(
    `SELECT * FROM websites WHERE id = $1 AND tenant_id = $2`,
    [websiteId, tenantId]
  );
  const row = rows[0];
  if (!row) {
    throw Object.assign(new Error('الموقع غير موجود'), { status: 404 });
  }
  return { row, mapped: await mapWebsiteRow(row) };
}

/** Enable/disable widget on the live site (all active sites work at the same time). */
export async function setWebsiteWidgetEnabled(tenantId, websiteId, enabled) {
  const { rows } = await query(
    'SELECT * FROM websites WHERE id = $1 AND tenant_id = $2',
    [websiteId, tenantId]
  );
  const row = rows[0];
  if (!row) {
    throw Object.assign(new Error('الموقع غير موجود'), { status: 404 });
  }

  if (enabled) {
    if (!row.verified && row.verification_token) {
      throw Object.assign(
        new Error('وثّق النطاق عبر DNS قبل تفعيل الويدجت على الموقع'),
        { status: 400, code: 'DNS_REQUIRED' }
      );
    }
    await assertCanEnableWebsiteWidget(tenantId, websiteId);
    const { rows: updated } = await query(
      `UPDATE websites SET status = 'active' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [websiteId, tenantId]
    );
    return mapWebsiteRow(updated[0]);
  }

  const { rows: updated } = await query(
    `UPDATE websites SET status = 'inactive' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [websiteId, tenantId]
  );
  return mapWebsiteRow(updated[0]);
}
