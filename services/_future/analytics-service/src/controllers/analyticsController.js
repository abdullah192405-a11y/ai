'use strict';

const analyticsService = require('../services/analyticsService');
const { success } = require('../../../shared/utils/response');
const { verifyJWT } = require('../../auth-service/src/middleware/authMiddleware');

async function analyticsRoutes(fastify) {
    fastify.addHook('onRequest', verifyJWT);

    // ─── Dashboard Overview ───────────────────────
    fastify.get('/dashboard', async (request, reply) => {
        const data = await analyticsService.getDashboard(
            fastify.db,
            fastify.redis,
            request.user.tenant_id,
            request.query,
        );
        return reply.send(success(data));
    });

    // ─── Query Analytics ──────────────────────────
    fastify.get('/queries', async (request, reply) => {
        const data = await analyticsService.getQueryAnalytics(
            fastify.db,
            request.user.tenant_id,
            request.query,
        );
        return reply.send(success(data));
    });

    // ─── Top Questions ────────────────────────────
    fastify.get('/top-questions', async (request, reply) => {
        const data = await analyticsService.getTopQuestions(
            fastify.db,
            request.user.tenant_id,
            request.query,
        );
        return reply.send(success(data));
    });

    // ─── Track Event (internal, from other services) ──
    fastify.post('/track', async (request, reply) => {
        await analyticsService.trackEvent(fastify.db, request.body);
        return reply.status(202).send({ accepted: true });
    });
}

module.exports = analyticsRoutes;
