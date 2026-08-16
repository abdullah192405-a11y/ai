'use strict';

const { NotFoundError } = require('../../../shared/errors');

/**
 * Platform overview metrics.
 */
async function getPlatformOverview(db, redis) {
    const [tenantCount] = await db('tenants').count('* as count');
    const [activeCount] = await db('tenants').where({ status: 'active' }).count('* as count');
    const [websiteCount] = await db('websites').count('* as count');
    const [documentCount] = await db('documents').count('* as count');

    const planDistribution = await db('tenants')
        .select('plan')
        .count('* as count')
        .groupBy('plan');

    return {
        total_tenants: parseInt(tenantCount.count, 10),
        active_tenants: parseInt(activeCount.count, 10),
        total_websites: parseInt(websiteCount.count, 10),
        total_documents: parseInt(documentCount.count, 10),
        plan_distribution: planDistribution.map((p) => ({
            plan: p.plan,
            count: parseInt(p.count, 10),
        })),
    };
}

/**
 * Lists all tenants with optional filters.
 */
async function listTenants(db, query = {}) {
    let q = db('tenants').select('*');

    if (query.status) q = q.where({ status: query.status });
    if (query.plan) q = q.where({ plan: query.plan });
    if (query.search) {
        q = q.where((builder) => {
            builder.where('name', 'ilike', `%${query.search}%`).orWhere('email', 'ilike', `%${query.search}%`);
        });
    }

    const tenants = await q.orderBy('created_at', 'desc').limit(parseInt(query.limit || '50', 10));
    const [{ count: total }] = await db('tenants').count('* as count');

    return { tenants, total: parseInt(total, 10) };
}

/**
 * Gets detailed tenant info with websites, usage, and API keys count.
 */
async function getTenantDetails(db, tenantId) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const websites = await db('websites').where({ tenant_id: tenantId }).select('*');
    const [apiKeyCount] = await db('api_keys')
        .where({ tenant_id: tenantId, revoked: false })
        .count('* as count');
    const [docCount] = await db('documents').where({ tenant_id: tenantId }).count('* as count');

    return {
        ...tenant,
        websites,
        api_key_count: parseInt(apiKeyCount.count, 10),
        document_count: parseInt(docCount.count, 10),
    };
}

async function updateTenant(db, tenantId, updates) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const allowed = ['name', 'plan', 'status', 'settings'];
    const updateData = { updated_at: new Date() };
    for (const key of allowed) {
        if (updates[key] !== undefined) updateData[key] = updates[key];
    }

    const [updated] = await db('tenants').where({ id: tenantId }).update(updateData).returning('*');
    return updated;
}

async function suspendTenant(db, redis, tenantId) {
    await db('tenants').where({ id: tenantId }).update({ status: 'suspended', updated_at: new Date() });
    // Invalidate cached API keys for this tenant
    const keys = await db('api_keys').where({ tenant_id: tenantId }).select('key_hash');
    for (const k of keys) {
        await redis.del(`auth:apikey:${k.key_hash}`);
    }
}

async function activateTenant(db, redis, tenantId) {
    await db('tenants').where({ id: tenantId }).update({ status: 'active', updated_at: new Date() });
}

async function getSystemHealth(redis) {
    const info = await redis.info('memory');
    const memMatch = info.match(/used_memory_human:(.+)/);
    return {
        redis: { memory: memMatch ? memMatch[1].trim() : 'unknown', status: 'healthy' },
        timestamp: new Date().toISOString(),
    };
}

async function getAuditLogs(db, query = {}) {
    let q = db('audit_logs').select('*');
    if (query.tenant_id) q = q.where({ tenant_id: query.tenant_id });
    if (query.action) q = q.where({ action: query.action });
    return q.orderBy('created_at', 'desc').limit(parseInt(query.limit || '50', 10));
}

module.exports = {
    getPlatformOverview,
    listTenants,
    getTenantDetails,
    updateTenant,
    suspendTenant,
    activateTenant,
    getSystemHealth,
    getAuditLogs,
};
