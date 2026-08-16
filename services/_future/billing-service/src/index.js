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
const billingRoutes = require('./controllers/billingController');
const webhookRoutes = require('./controllers/webhookController');
const healthRoutes = require('./controllers/healthController');

const logger = createLogger('billing-service');

async function buildApp() {
    const app = Fastify({ logger: false, genReqId: () => require('uuid').v7() });

    await app.register(cors, { origin: process.env.CORS_ORIGINS?.split(',') || ['*'], credentials: true });
    await app.register(helmet);
    await app.register(requestContext);
    app.setErrorHandler(errorHandler);

    const db = createDatabase();
    const redis = createRedis();
    await redis.connect();

    app.decorate('db', db);
    app.decorate('redis', redis);
    app.decorate('logger', logger);

    app.register(healthRoutes, { prefix: '/health' });
    app.register(billingRoutes, { prefix: '/v1/billing' });
    app.register(webhookRoutes, { prefix: '/v1/billing/webhooks' });

    const shutdown = async () => {
        logger.info('Shutting down billing-service...');
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
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3003', 10);
    await app.listen({ port, host: process.env.HOST || '0.0.0.0' });
    logger.info(`Billing service running on port ${port}`);
}

start();
module.exports = { buildApp };
