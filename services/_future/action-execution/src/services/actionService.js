'use strict';

const { v7: uuidv7 } = require('uuid');
const { ValidationError } = require('../../../shared/errors');

const ALLOWED_ACTIONS = {
    navigate: { description: 'Navigate to a URL or page', requiresApproval: false },
    scroll_to: { description: 'Scroll to a specific section', requiresApproval: false },
    highlight: { description: 'Highlight an element on the page', requiresApproval: false },
    download: { description: 'Initiate a file download', requiresApproval: true },
    form_fill: { description: 'Pre-fill a form field (no submit)', requiresApproval: true },
};

/**
 * Executes an action after validation and optional approval.
 */
async function executeAction(redis, { session_id, action, user_approved }) {
    const actionType = ALLOWED_ACTIONS[action.type];
    if (!actionType) {
        throw new ValidationError(`Unknown action type: ${action.type}`);
    }

    // Check if approval is required but not given
    if (actionType.requiresApproval && !user_approved) {
        const pendingId = uuidv7();

        // Store pending action in Redis for the session
        await redis.setex(
            `action:pending:${session_id}:${pendingId}`,
            300, // 5 minute TTL
            JSON.stringify({ id: pendingId, ...action }),
        );

        return {
            status: 'pending_approval',
            action_id: pendingId,
            message: `Action '${action.type}' requires user approval before execution.`,
            action: action,
        };
    }

    // Execute the action — returns instruction for client-side execution
    const executionId = uuidv7();

    // Log the execution
    await redis.lpush(
        `action:log:${session_id}`,
        JSON.stringify({
            id: executionId,
            type: action.type,
            target: action.target,
            label: action.label,
            executed_at: new Date().toISOString(),
        }),
    );
    await redis.expire(`action:log:${session_id}`, 86400); // 24 hour TTL

    return {
        status: 'executed',
        action_id: executionId,
        instruction: buildClientInstruction(action),
    };
}

/**
 * Builds the instruction object for client-side action execution.
 */
function buildClientInstruction(action) {
    switch (action.type) {
        case 'navigate':
            return { type: 'navigate', url: action.target, new_tab: action.params?.new_tab || false };
        case 'scroll_to':
            return { type: 'scroll', selector: action.target, behavior: 'smooth' };
        case 'highlight':
            return {
                type: 'highlight',
                selector: action.target,
                style: { outline: '3px solid #6366f1', background: 'rgba(99, 102, 241, 0.1)' },
                duration_ms: 3000,
            };
        case 'download':
            return { type: 'download', url: action.target, filename: action.params?.filename };
        case 'form_fill':
            return { type: 'form_fill', selector: action.target, value: action.params?.value };
        default:
            return { type: action.type, target: action.target };
    }
}

/**
 * Gets pending actions for a session.
 */
async function getPendingActions(redis, sessionId) {
    const keys = await redis.keys(`action:pending:${sessionId}:*`);
    if (!keys.length) return [];

    const pipeline = redis.pipeline();
    keys.forEach((key) => pipeline.get(key));
    const results = await pipeline.exec();

    return results
        .filter(([err, val]) => !err && val)
        .map(([, val]) => JSON.parse(val));
}

/**
 * Returns all available action types.
 */
function getAvailableActionTypes() {
    return Object.entries(ALLOWED_ACTIONS).map(([type, config]) => ({
        type,
        ...config,
    }));
}

module.exports = { executeAction, getPendingActions, getAvailableActionTypes };
