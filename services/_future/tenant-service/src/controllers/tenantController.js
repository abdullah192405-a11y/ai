'use strict';

const tenantService = require('../services/tenantService');
const { success } = require('../../../shared/utils/response');
const { verifyJWT } = require('../../auth-service/src/middleware/authMiddleware');

async function tenantRoutes(fastify) {
    fastify.addHook('onRequest', verifyJWT);

    // ─── Get Tenant Details ─────────────────────
    fastify.get('/:tenantId', async (request, reply) => {
        const tenant = await tenantService.getTenant(fastify.db, request.params.tenantId);
        return reply.send(success(tenant));
    });

    // ─── Update Tenant Settings ─────────────────
    fastify.patch(
        '/:tenantId/settings',
        {
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', minLength: 2 },
                        settings: { type: 'object' },
                    },
                },
            },
        },
        async (request, reply) => {
            const tenant = await tenantService.updateTenant(
                fastify.db,
                request.params.tenantId,
                request.body,
            );
            return reply.send(success(tenant));
        },
    );
}

module.exports = tenantRoutes;
