'use strict';

require('dotenv').config();

const Fastify = require('fastify');
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const { createLogger } = require('../../shared/logger');
const { createRedis } = require('../../shared/utils/redis');
const { errorHandler } = require('../../shared/middleware/errorHandler');
const requestContext = require('../../shared/middleware/requestContext');
const actionRoutes = require('./controllers/actionController');

const logger = createLogger('action-execution');

async function buildApp() {
    const app = Fastify({ logger: false, genReqId: () => require('uuid').v7() });
    await app.register(cors, { origin: '*', credentials: true });
    await app.register(helmet);
    await app.register(requestContext);
    app.setErrorHandler(errorHandler);

    const redis = createRedis();
    await redis.connect();
    app.decorate('redis', redis);
    app.decorate('logger', logger);

    app.get('/health', async (req, reply) => {
        try { await redis.ping(); return reply.send({ status: 'healthy', service: 'action-execution' }); }
        catch { return reply.status(503).send({ status: 'unhealthy', service: 'action-execution' }); }
    });

    app.register(actionRoutes, { prefix: '/v1/actions' });

    process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
    process.on('SIGINT', async () => { await app.close(); process.exit(0); });

    return app;
}

async function start() {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3004', 10);
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`Action execution service running on port ${port}`);
}

start();
module.exports = { buildApp };
