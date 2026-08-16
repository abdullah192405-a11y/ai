'use strict';

const billingService = require('../services/billingService');

async function webhookRoutes(fastify) {
    // Stripe webhooks use raw body — disable content type parsing
    fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
        done(null, body);
    });

    fastify.post('/stripe', async (request, reply) => {
        const sig = request.headers['stripe-signature'];
        try {
            await billingService.handleStripeWebhook(fastify.db, request.body, sig);
            return reply.status(200).send({ received: true });
        } catch (err) {
            fastify.logger?.error(err, 'Stripe webhook error');
            return reply.status(400).send({ error: err.message });
        }
    });
}

module.exports = webhookRoutes;
