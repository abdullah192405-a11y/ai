'use strict';

const { NotFoundError } = require('../../../shared/errors');

async function getTenant(db, tenantId) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new NotFoundError('Tenant', tenantId);
    return tenant;
}

async function updateTenant(db, tenantId, updates) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const updateData = { updated_at: new Date() };
    if (updates.name) updateData.name = updates.name;
    if (updates.settings) {
        updateData.settings = { ...tenant.settings, ...updates.settings };
    }

    const [updated] = await db('tenants').where({ id: tenantId }).update(updateData).returning('*');
    return updated;
}

module.exports = { getTenant, updateTenant };
