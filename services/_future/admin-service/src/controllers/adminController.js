'use strict';

const adminService = require('../services/adminService');
const { success, paginated } = require('../../../shared/utils/response');
const { verifyJWT, requireRole } = require('../../auth-service/src/middleware/authMiddleware');
const { ROLES } = require('../../../shared/constants');

async function adminRoutes(fastify) {
    fastify.addHook('onRequest', verifyJWT);
    fastify.addHook('onRequest', requireRole(ROLES.PLATFORM_ADMIN));

    // ─── Platform Overview ────────────────────────
    fastify.get('/overview', async (request, reply) => {
        const overview = await adminService.getPlatformOverview(fastify.db, fastify.redis);
        return reply.send(success(overview));
    });

    // ─── List All Tenants ─────────────────────────
    fastify.get('/tenants', async (request, reply) => {
        const { tenants, total } = await adminService.listTenants(fastify.db, request.query);
        return reply.send(paginated(tenants, { totalCount: total, hasMore: false }));
    });

    // ─── Get Tenant Details ───────────────────────
    fastify.get('/tenants/:tenantId', async (request, reply) => {
        const tenant = await adminService.getTenantDetails(fastify.db, request.params.tenantId);
        return reply.send(success(tenant));
    });

    // ─── Update Tenant (admin override) ───────────
    fastify.patch('/tenants/:tenantId', async (request, reply) => {
        const tenant = await adminService.updateTenant(fastify.db, request.params.tenantId, request.body);
        return reply.send(success(tenant));
    });

    // ─── Suspend/Activate Tenant ──────────────────
    fastify.post('/tenants/:tenantId/suspend', async (request, reply) => {
        await adminService.suspendTenant(fastify.db, fastify.redis, request.params.tenantId);
        return reply.send(success({ message: 'Tenant suspended' }));
    });

    fastify.post('/tenants/:tenantId/activate', async (request, reply) => {
        await adminService.activateTenant(fastify.db, fastify.redis, request.params.tenantId);
        return reply.send(success({ message: 'Tenant activated' }));
    });

    // ─── System Health ────────────────────────────
    fastify.get('/system-health', async (request, reply) => {
        const health = await adminService.getSystemHealth(fastify.redis);
        return reply.send(success(health));
    });

    // ─── Audit Logs ───────────────────────────────
    fastify.get('/audit-logs', async (request, reply) => {
        const logs = await adminService.getAuditLogs(fastify.db, request.query);
        return reply.send(paginated(logs, { totalCount: logs.length, hasMore: logs.length >= 50 }));
    });
}

module.exports = adminRoutes;
