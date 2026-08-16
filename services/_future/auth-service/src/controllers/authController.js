'use strict';

const authService = require('../services/authService');
const { success } = require('../../../shared/utils/response');

const registerSchema = {
    body: {
        type: 'object',
        required: ['email', 'password', 'org_name'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            org_name: { type: 'string', minLength: 2, maxLength: 255 },
        },
    },
};

const loginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
        },
    },
};

const refreshSchema = {
    body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
            refresh_token: { type: 'string' },
        },
    },
};

async function authRoutes(fastify) {
    // ─── Register ─────────────────────────────────
    fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
        const { email, password, org_name } = request.body;
        const result = await authService.register(fastify.db, { email, password, orgName: org_name });
        return reply.status(201).send(success(result));
    });

    // ─── Login ────────────────────────────────────
    fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
        const { email, password } = request.body;
        const result = await authService.login(fastify.db, { email, password });
        return reply.send(success(result));
    });

    // ─── Refresh Token ────────────────────────────
    fastify.post('/refresh', { schema: refreshSchema }, async (request, reply) => {
        const { refresh_token } = request.body;
        const result = await authService.refreshToken(refresh_token);
        return reply.send(success(result));
    });
}

module.exports = authRoutes;
