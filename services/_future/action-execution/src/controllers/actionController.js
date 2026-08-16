'use strict';

const actionService = require('../services/actionService');
const { success } = require('../../../shared/utils/response');

async function actionRoutes(fastify) {
    // ─── Execute Action ────────────────────────────
    fastify.post(
        '/execute',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['session_id', 'action'],
                    properties: {
                        session_id: { type: 'string' },
                        action: {
                            type: 'object',
                            required: ['type', 'target'],
                            properties: {
                                type: { type: 'string', enum: ['navigate', 'scroll_to', 'highlight', 'download', 'form_fill'] },
                                target: { type: 'string' },
                                label: { type: 'string' },
                                params: { type: 'object' },
                            },
                        },
                        user_approved: { type: 'boolean', default: false },
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await actionService.executeAction(fastify.redis, request.body);
            return reply.send(success(result));
        },
    );

    // ─── Get Pending Actions ──────────────────────
    fastify.get('/pending/:sessionId', async (request, reply) => {
        const actions = await actionService.getPendingActions(fastify.redis, request.params.sessionId);
        return reply.send(success(actions));
    });

    // ─── Define Available Actions for a Website ───
    fastify.get('/available', async (request, reply) => {
        const actions = actionService.getAvailableActionTypes();
        return reply.send(success(actions));
    });
}

module.exports = actionRoutes;
