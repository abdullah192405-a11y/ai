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
const tenantRoutes = require('./controllers/tenantController');
const websiteRoutes = require('./controllers/websiteController');
const healthRoutes = require('./controllers/healthController');

const logger = createLogger('tenant-service');

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
    app.register(tenantRoutes, { prefix: '/v1/tenants' });
    app.register(websiteRoutes, { prefix: '/v1/tenants' });

    const shutdown = async () => {
        logger.info('Shutting down tenant-service...');
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
    const port = parseInt(process.env.PORT || '3002', 10);
    await app.listen({ port, host: process.env.HOST || '0.0.0.0' });
    logger.info(`Tenant service running on port ${port}`);
}

start();
module.exports = { buildApp };
