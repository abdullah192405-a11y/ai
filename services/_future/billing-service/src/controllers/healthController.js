'use strict';

async function healthRoutes(fastify) {
    fastify.get('/', async (request, reply) => {
        const checks = {};
        try { await fastify.db.raw('SELECT 1'); checks.database = 'healthy'; } catch { checks.database = 'unhealthy'; }
        try { await fastify.redis.ping(); checks.redis = 'healthy'; } catch { checks.redis = 'unhealthy'; }
        const isHealthy = Object.values(checks).every((s) => s === 'healthy');
        return reply.status(isHealthy ? 200 : 503).send({ status: isHealthy ? 'healthy' : 'degraded', service: 'billing-service', timestamp: new Date().toISOString(), checks });
    });
}
module.exports = healthRoutes;
