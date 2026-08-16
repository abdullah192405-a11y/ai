'use strict';

const apiKeyService = require('../services/apiKeyService');
const { success, paginated } = require('../../../shared/utils/response');
const authMiddleware = require('../middleware/authMiddleware');

async function apiKeyRoutes(fastify) {
    // All API key routes require JWT authentication
    fastify.addHook('onRequest', authMiddleware.verifyJWT);

    // ─── Create API Key ───────────────────────────
    fastify.post(
        '/',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string', minLength: 1, maxLength: 255 },
                        scopes: {
                            type: 'array',
                            items: { type: 'string' },
                            default: ['read:assistant'],
                        },
                        website_id: { type: 'string', format: 'uuid' },
                        expires_in_days: { type: 'integer', minimum: 1, maximum: 365 },
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await apiKeyService.createApiKey(fastify.db, {
                tenantId: request.user.tenant_id,
                ...request.body,
            });
            return reply.status(201).send(success(result));
        },
    );

    // ─── List API Keys ────────────────────────────
    fastify.get('/', async (request, reply) => {
        const keys = await apiKeyService.listApiKeys(fastify.db, request.user.tenant_id);
        return reply.send(paginated(keys, { totalCount: keys.length, hasMore: false }));
    });

    // ─── Revoke API Key ───────────────────────────
    fastify.delete('/:keyId', async (request, reply) => {
        await apiKeyService.revokeApiKey(fastify.db, fastify.redis, {
            keyId: request.params.keyId,
            tenantId: request.user.tenant_id,
        });
        return reply.status(204).send();
    });

    // ─── Verify API Key (internal endpoint) ───────
    fastify.post('/verify', { schema: { body: { type: 'object', required: ['api_key'], properties: { api_key: { type: 'string' } } } } }, async (request, reply) => {
        const result = await apiKeyService.verifyApiKey(fastify.db, fastify.redis, request.body.api_key);
        return reply.send(success(result));
    });
}

module.exports = apiKeyRoutes;
