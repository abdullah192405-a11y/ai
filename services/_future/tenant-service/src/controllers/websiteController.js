'use strict';

const websiteService = require('../services/websiteService');
const { success, paginated } = require('../../../shared/utils/response');
const { verifyJWT } = require('../../auth-service/src/middleware/authMiddleware');

async function websiteRoutes(fastify) {
    fastify.addHook('onRequest', verifyJWT);

    // ─── Register Website ────────────────────────
    fastify.post(
        '/:tenantId/websites',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['domain'],
                    properties: {
                        domain: { type: 'string', minLength: 3, maxLength: 255 },
                        settings: { type: 'object' },
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await websiteService.registerWebsite(fastify.db, {
                tenantId: request.params.tenantId,
                domain: request.body.domain,
                settings: request.body.settings,
            });
            return reply.status(201).send(success(result));
        },
    );

    // ─── List Websites ───────────────────────────
    fastify.get('/:tenantId/websites', async (request, reply) => {
        const websites = await websiteService.listWebsites(fastify.db, request.params.tenantId);
        return reply.send(paginated(websites, { totalCount: websites.length, hasMore: false }));
    });

    // ─── Get Website Details ─────────────────────
    fastify.get('/:tenantId/websites/:websiteId', async (request, reply) => {
        const website = await websiteService.getWebsite(
            fastify.db,
            request.params.tenantId,
            request.params.websiteId,
        );
        return reply.send(success(website));
    });

    // ─── Verify Domain ───────────────────────────
    fastify.post('/:tenantId/websites/:websiteId/verify', async (request, reply) => {
        const result = await websiteService.verifyDomain(
            fastify.db,
            request.params.tenantId,
            request.params.websiteId,
        );
        return reply.send(success(result));
    });

    // ─── Delete Website ──────────────────────────
    fastify.delete('/:tenantId/websites/:websiteId', async (request, reply) => {
        await websiteService.deleteWebsite(
            fastify.db,
            request.params.tenantId,
            request.params.websiteId,
        );
        return reply.status(204).send();
    });
}

module.exports = websiteRoutes;
