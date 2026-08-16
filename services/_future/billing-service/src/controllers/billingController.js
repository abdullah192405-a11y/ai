'use strict';

const billingService = require('../services/billingService');
const { success, paginated } = require('../../../shared/utils/response');
const { verifyJWT, requireRole } = require('../../auth-service/src/middleware/authMiddleware');
const { ROLES } = require('../../../shared/constants');

async function billingRoutes(fastify) {
    fastify.addHook('onRequest', verifyJWT);

    // ─── Get Current Plan ─────────────────────────
    fastify.get('/plan', async (request, reply) => {
        const plan = await billingService.getCurrentPlan(fastify.db, request.user.tenant_id);
        return reply.send(success(plan));
    });

    // ─── Create Checkout Session ──────────────────
    fastify.post(
        '/checkout',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['plan'],
                    properties: {
                        plan: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
                        billing_cycle: { type: 'string', enum: ['monthly', 'annual'], default: 'monthly' },
                    },
                },
            },
        },
        async (request, reply) => {
            const session = await billingService.createCheckoutSession(
                fastify.db,
                request.user.tenant_id,
                request.body,
            );
            return reply.send(success(session));
        },
    );

    // ─── Get Usage Summary ────────────────────────
    fastify.get('/usage', async (request, reply) => {
        const usage = await billingService.getUsageSummary(
            fastify.db,
            fastify.redis,
            request.user.tenant_id,
        );
        return reply.send(success(usage));
    });

    // ─── Get Invoices ─────────────────────────────
    fastify.get('/invoices', async (request, reply) => {
        const invoices = await billingService.getInvoices(fastify.db, request.user.tenant_id);
        return reply.send(paginated(invoices, { totalCount: invoices.length, hasMore: false }));
    });

    // ─── Cancel Subscription ─────────────────────
    fastify.post('/cancel', async (request, reply) => {
        await requireRole(ROLES.TENANT_OWNER)(request, reply);
        const result = await billingService.cancelSubscription(fastify.db, request.user.tenant_id);
        return reply.send(success(result));
    });
}

module.exports = billingRoutes;
