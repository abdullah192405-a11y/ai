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
const authRoutes = require('./controllers/authController');
const apiKeyRoutes = require('./controllers/apiKeyController');
const healthRoutes = require('./controllers/healthController');

const logger = createLogger('auth-service');

async function buildApp() {
    const app = Fastify({
        logger: false,
        genReqId: () => require('uuid').v7(),
        ajv: { customOptions: { allErrors: true } },
    });

    // ─── Plugins ──────────────────────────────────
    await app.register(cors, {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
    });
    await app.register(helmet);
    await app.register(requestContext);

    // ─── Error Handler ────────────────────────────
    app.setErrorHandler(errorHandler);

    // ─── Infrastructure ───────────────────────────
    const db = createDatabase();
    const redis = createRedis();
    await redis.connect();

    // Decorate app with shared instances
    app.decorate('db', db);
    app.decorate('redis', redis);
    app.decorate('logger', logger);

    // ─── Routes ───────────────────────────────────
    app.register(healthRoutes, { prefix: '/health' });
    app.register(authRoutes, { prefix: '/v1/auth' });
    app.register(apiKeyRoutes, { prefix: '/v1/auth/api-keys' });

    // ─── Graceful Shutdown ────────────────────────
    const shutdown = async () => {
        logger.info('Shutting down auth-service...');
        await app.close();
        await require('../../shared/utils/database').closeDatabase();
        await require('../../shared/utils/redis').closeRedis();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    return app;
}

async function start() {
    try {
        const app = await buildApp();
        const port = parseInt(process.env.PORT || '3001', 10);
        const host = process.env.HOST || '0.0.0.0';

        await app.listen({ port, host });
        logger.info(`Auth service running on ${host}:${port}`);
    } catch (err) {
        logger.error(err, 'Failed to start auth-service');
        process.exit(1);
    }
}

start();

module.exports = { buildApp };
