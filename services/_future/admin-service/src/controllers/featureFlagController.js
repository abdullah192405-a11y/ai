'use strict';

const featureFlagService = require('../services/featureFlagService');
const { success, paginated } = require('../../../shared/utils/response');
const { verifyJWT, requireRole } = require('../../auth-service/src/middleware/authMiddleware');
const { ROLES } = require('../../../shared/constants');

async function featureFlagRoutes(fastify) {
    fastify.addHook('onRequest', verifyJWT);
    fastify.addHook('onRequest', requireRole(ROLES.PLATFORM_ADMIN));

    // ─── List Feature Flags ───────────────────────
    fastify.get('/', async (request, reply) => {
        const flags = await featureFlagService.listFlags(fastify.db);
        return reply.send(paginated(flags, { totalCount: flags.length, hasMore: false }));
    });

    // ─── Create Feature Flag ─────────────────────
    fastify.post(
        '/',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['key', 'description'],
                    properties: {
                        key: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
                        description: { type: 'string' },
                        scope: { type: 'string', enum: ['global', 'tenant', 'plan'], default: 'global' },
                        enabled: { type: 'boolean', default: false },
                        conditions: { type: 'object' },
                    },
                },
            },
        },
        async (request, reply) => {
            const flag = await featureFlagService.createFlag(fastify.db, fastify.redis, request.body);
            return reply.status(201).send(success(flag));
        },
    );

    // ─── Toggle Feature Flag ─────────────────────
    fastify.patch('/:flagId', async (request, reply) => {
        const flag = await featureFlagService.updateFlag(
            fastify.db,
            fastify.redis,
            request.params.flagId,
            request.body,
        );
        return reply.send(success(flag));
    });

    // ─── Delete Feature Flag ─────────────────────
    fastify.delete('/:flagId', async (request, reply) => {
        await featureFlagService.deleteFlag(fastify.db, fastify.redis, request.params.flagId);
        return reply.status(204).send();
    });

    // ─── Evaluate Flag (internal) ─────────────────
    fastify.post('/evaluate', async (request, reply) => {
        const result = await featureFlagService.evaluateFlag(
            fastify.db,
            fastify.redis,
            request.body.key,
            request.body.context,
        );
        return reply.send(success(result));
    });
}

module.exports = featureFlagRoutes;
