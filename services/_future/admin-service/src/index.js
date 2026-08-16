'use strict';

require('dotenv').config();

const Fastify = require('fastify');
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const { createLogger } = require('../../shared/logger');
const { createDatabase } = require('../../shared/utils/database');
const { createRedis } = require('../../shared/utils/redis');
const { errorHandler } = require('../../shared/middleware/errorHandler');
const requestContext = require('../../shared/middleware/requestContext');
const adminRoutes = require('./controllers/adminController');
const featureFlagRoutes = require('./controllers/featureFlagController');

const logger = createLogger('admin-service');

async function buildApp() {
    const app = Fastify({ logger: false, genReqId: () => require('uuid').v7() });
    await app.register(cors, { origin: '*', credentials: true });
    await app.register(helmet);
    await app.register(requestContext);
    app.setErrorHandler(errorHandler);

    const db = createDatabase();
    const redis = createRedis();
    await redis.connect();
    app.decorate('db', db);
    app.decorate('redis', redis);
    app.decorate('logger', logger);

    app.get('/health', async (req, reply) => {
        const checks = {};
        try { await db.raw('SELECT 1'); checks.database = 'healthy'; } catch { checks.database = 'unhealthy'; }
        try { await redis.ping(); checks.redis = 'healthy'; } catch { checks.redis = 'unhealthy'; }
        const ok = Object.values(checks).every((s) => s === 'healthy');
        return reply.status(ok ? 200 : 503).send({ status: ok ? 'healthy' : 'degraded', service: 'admin-service', checks });
    });

    app.register(adminRoutes, { prefix: '/v1/admin' });
    app.register(featureFlagRoutes, { prefix: '/v1/admin/feature-flags' });

    process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
    process.on('SIGINT', async () => { await app.close(); process.exit(0); });

    return app;
}

async function start() {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3006', 10);
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`Admin service running on port ${port}`);
}

start();
module.exports = { buildApp };
