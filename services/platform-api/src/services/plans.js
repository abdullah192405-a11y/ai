/** Subscription plan limits — enforced on API and exposed to the dashboard. */

import {
  PLAN_LABELS,
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  normalizePlan,
  getPlanLimits,
  getPublicPlans,
} from '@wba/plans';
import { query } from '../db.js';

export { PLAN_LABELS, PLAN_DEFINITIONS, PLAN_ORDER, normalizePlan, getPlanLimits, getPublicPlans };

export async function updateTenantPlan(tenantId, plan) {
  const id = normalizePlan(plan);
  const { rows } = await query(
    'UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2 RETURNING plan',
    [id, tenantId]
  );
  if (!rows[0]) {
    throw Object.assign(new Error('المشترك غير موجود'), { status: 404 });
  }
  const limits = getPlanLimits(rows[0].plan);
  const enforcement = await enforcePlanLimits(tenantId);
  return { ...limits, enforcement };
}

/** Apply all downgrade rules when plan changes (any tier → lower tier). */
export async function enforcePlanLimits(tenantId) {
  const websites = await enforceWebsitePlanLimit(tenantId);
  const apiKeys = await enforceApiKeyPlanLimit(tenantId);
  return { websites, apiKeys };
}

/**
 * After a downgrade, keep the oldest N websites usable; deactivate widget on the rest.
 * Applies to every plan with a website cap (مجاني=1, مبتدئ=3, احترافي=10).
 */
export async function enforceWebsitePlanLimit(tenantId) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));
  if (limits.websites == null) {
    return { kept: [], deactivated: [], overLimit: 0 };
  }

  const { rows } = await query(
    `SELECT id, domain, status FROM websites
      WHERE tenant_id = $1
      ORDER BY created_at ASC`,
    [tenantId]
  );

  const total = rows.length;
  const overLimit = Math.max(0, total - limits.websites);
  if (overLimit === 0) {
    return { kept: rows.map((w) => w.domain), deactivated: [], overLimit: 0 };
  }

  const keep = rows.slice(0, limits.websites);
  const excess = rows.slice(limits.websites);
  const deactivated = [];

  for (const w of excess) {
    if (w.status === 'active') {
      await query(`UPDATE websites SET status = 'inactive' WHERE id = $1 AND tenant_id = $2`, [
        w.id,
        tenantId,
      ]);
      deactivated.push(w.domain);
    }
  }

  return {
    kept: keep.map((w) => w.domain),
    deactivated,
    overLimit,
  };
}

/**
 * After a downgrade, keep the oldest N API keys; revoke the rest.
 * Applies to every plan with a key cap (مجاني=1, مبتدئ=3, احترافي=10).
 */
export async function enforceApiKeyPlanLimit(tenantId) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));
  if (limits.apiKeys == null) {
    return { kept: [], revoked: [], overLimit: 0 };
  }

  const { rows } = await query(
    `SELECT id, name, key_prefix FROM api_keys
      WHERE tenant_id = $1 AND NOT revoked
      ORDER BY created_at ASC`,
    [tenantId]
  );

  const overLimit = Math.max(0, rows.length - limits.apiKeys);
  if (overLimit === 0) {
    return { kept: rows.map((k) => k.key_prefix), revoked: [], overLimit: 0 };
  }

  const keep = rows.slice(0, limits.apiKeys);
  const excess = rows.slice(limits.apiKeys);
  const revoked = [];

  for (const k of excess) {
    await query('UPDATE api_keys SET revoked = TRUE WHERE id = $1 AND tenant_id = $2', [
      k.id,
      tenantId,
    ]);
    revoked.push(k.name || k.key_prefix);
  }

  return {
    kept: keep.map((k) => k.key_prefix),
    revoked,
    overLimit,
  };
}

export function formatPlanEnforcementMessage(limits, enforcement) {
  const parts = [`تم تحديث الباقة إلى ${limits.label}`];
  if (enforcement?.websites?.deactivated?.length) {
    parts.push(`إيقاف الويدجت على: ${enforcement.websites.deactivated.join('، ')}`);
  }
  if (enforcement?.apiKeys?.revoked?.length) {
    parts.push(`إلغاء مفاتيح API: ${enforcement.apiKeys.revoked.join('، ')}`);
  }
  return parts.join(' — ');
}

/** Block enabling widget when active sites would exceed plan allowance. */
export async function assertCanEnableWebsiteWidget(tenantId, websiteId) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));
  if (limits.websites == null) return limits;

  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM websites
      WHERE tenant_id = $1 AND status = 'active' AND id != $2`,
    [tenantId, websiteId]
  );
  const otherActive = rows[0]?.n || 0;
  if (otherActive >= limits.websites) {
    throw planLimitError(
      limits.websites === 1
        ? `باقة ${limits.label} تسمح بموقع نشط واحد. أوقِف المواقع الأخرى أو احذفها أو رقِّ باقتك.`
        : `باقة ${limits.label} تسمح بـ ${limits.websites} مواقع نشطة فقط.`,
      'WEBSITE_LIMIT'
    );
  }
  return limits;
}

export function planLimitError(message, code = 'PLAN_LIMIT') {
  return Object.assign(new Error(message), { status: 403, code });
}

export async function getTenantPlan(tenantId) {
  const { rows } = await query('SELECT plan FROM tenants WHERE id = $1', [tenantId]);
  return normalizePlan(rows[0]?.plan);
}

export async function getTenantUsage(tenantId, websiteId = null) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));

  const [websitesRes, queriesRes, apiKeysRes, websiteDocsRes] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM websites WHERE tenant_id = $1', [tenantId]),
    query(
      `SELECT COUNT(*)::int AS n FROM messages
        WHERE tenant_id = $1 AND role = 'user'
          AND created_at >= date_trunc('month', NOW())`,
      [tenantId]
    ),
    query(
      'SELECT COUNT(*)::int AS n FROM api_keys WHERE tenant_id = $1 AND NOT revoked',
      [tenantId]
    ),
    websiteId
      ? query('SELECT COUNT(*)::int AS n FROM documents WHERE website_id = $1', [websiteId])
      : Promise.resolve({ rows: [{ n: 0 }] }),
  ]);

  return {
    plan: limits.id,
    planLabel: limits.label,
    limits: {
      websites: limits.websites,
      queriesPerMonth: limits.queriesPerMonth,
      documentsPerWebsite: limits.documentsPerWebsite,
      apiKeys: limits.apiKeys,
      maxUploadMb: limits.maxUploadMb,
    },
    used: {
      websites: websitesRes.rows[0]?.n || 0,
      queriesThisMonth: queriesRes.rows[0]?.n || 0,
      documentsOnWebsite: websiteDocsRes.rows[0]?.n || 0,
      apiKeys: apiKeysRes.rows[0]?.n || 0,
    },
    overLimitWebsites:
      limits.websites == null
        ? 0
        : Math.max(0, (websitesRes.rows[0]?.n || 0) - limits.websites),
    overLimitApiKeys:
      limits.apiKeys == null
        ? 0
        : Math.max(0, (apiKeysRes.rows[0]?.n || 0) - limits.apiKeys),
    overLimitDocuments:
      limits.documentsPerWebsite == null || !websiteId
        ? 0
        : Math.max(0, (websiteDocsRes.rows[0]?.n || 0) - limits.documentsPerWebsite),
  };
}

export async function assertCanAddWebsite(tenantId) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));
  if (limits.websites == null) return limits;

  const { rows } = await query(
    'SELECT COUNT(*)::int AS n FROM websites WHERE tenant_id = $1',
    [tenantId]
  );
  const used = rows[0]?.n || 0;
  if (used >= limits.websites) {
    throw planLimitError(
      limits.websites === 1
        ? `باقة ${limits.label} تسمح بموقع واحد فقط. ترقّ للباقة الأعلى لإضافة مواقع إضافية.`
        : `وصلت بحد ${limits.websites} مواقع في باقة ${limits.label}. ترقّ للباقة الأعلى.`,
      'WEBSITE_LIMIT'
    );
  }
  return limits;
}

export async function assertCanUploadDocument(tenantId, websiteId, fileSizeBytes = 0) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));

  if (limits.maxUploadMb != null && fileSizeBytes > limits.maxUploadMb * 1024 * 1024) {
    throw planLimitError(
      `حد الرفع في باقة ${limits.label}: ${limits.maxUploadMb} MB`,
      'UPLOAD_SIZE_LIMIT'
    );
  }

  if (limits.documentsPerWebsite == null) return limits;

  const { rows } = await query(
    'SELECT COUNT(*)::int AS n FROM documents WHERE website_id = $1',
    [websiteId]
  );
  if ((rows[0]?.n || 0) >= limits.documentsPerWebsite) {
    throw planLimitError(
      `وصلت بحد ${limits.documentsPerWebsite} مستند في باقة ${limits.label} لهذا الموقع.`,
      'DOCUMENT_LIMIT'
    );
  }
  return limits;
}

export async function assertCanCreateApiKey(tenantId) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));
  if (limits.apiKeys == null) return limits;

  const { rows } = await query(
    'SELECT COUNT(*)::int AS n FROM api_keys WHERE tenant_id = $1 AND NOT revoked',
    [tenantId]
  );
  if ((rows[0]?.n || 0) >= limits.apiKeys) {
    throw planLimitError(
      limits.apiKeys === 1
        ? `باقة ${limits.label} تسمح بمفتاح API واحد. ترقّ للباقة الأعلى.`
        : `وصلت بحد ${limits.apiKeys} مفاتيح API في باقة ${limits.label}.`,
      'API_KEY_LIMIT'
    );
  }
  return limits;
}

export async function assertCanQuery(tenantId) {
  const limits = getPlanLimits(await getTenantPlan(tenantId));
  if (limits.queriesPerMonth == null) return limits;

  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM messages
      WHERE tenant_id = $1 AND role = 'user'
        AND created_at >= date_trunc('month', NOW())`,
    [tenantId]
  );
  if ((rows[0]?.n || 0) >= limits.queriesPerMonth) {
    throw planLimitError(
      `تجاوزت حد ${limits.queriesPerMonth.toLocaleString('ar-SA')} استعلام/شهر في باقة ${limits.label}.`,
      'QUERY_LIMIT'
    );
  }
  return limits;
}
