'use strict';

const { v7: uuidv7 } = require('uuid');
const { NotFoundError, ConflictError } = require('../../../shared/errors');

const FLAG_CACHE_PREFIX = 'ff:';
const FLAG_CACHE_TTL = 60; // 1 minute

/**
 * Lists all feature flags.
 */
async function listFlags(db) {
    return db('feature_flags').select('*').orderBy('key', 'asc');
}

/**
 * Creates a new feature flag.
 */
async function createFlag(db, redis, { key, description, scope, enabled, conditions }) {
    const existing = await db('feature_flags').where({ key }).first();
    if (existing) throw new ConflictError(`Feature flag '${key}' already exists`);

    const [flag] = await db('feature_flags')
        .insert({
            id: uuidv7(),
            key,
            description,
            scope: scope || 'global',
            enabled: enabled || false,
            conditions: conditions || {},
        })
        .returning('*');

    // Cache the flag
    await redis.setex(`${FLAG_CACHE_PREFIX}${key}`, FLAG_CACHE_TTL, JSON.stringify(flag));

    return flag;
}

/**
 * Updates a feature flag (toggle, conditions, etc.).
 */
async function updateFlag(db, redis, flagId, updates) {
    const flag = await db('feature_flags').where({ id: flagId }).first();
    if (!flag) throw new NotFoundError('Feature Flag', flagId);

    const updateData = { updated_at: new Date() };
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.description) updateData.description = updates.description;
    if (updates.conditions) updateData.conditions = updates.conditions;

    const [updated] = await db('feature_flags').where({ id: flagId }).update(updateData).returning('*');

    // Update cache
    await redis.setex(`${FLAG_CACHE_PREFIX}${updated.key}`, FLAG_CACHE_TTL, JSON.stringify(updated));

    return updated;
}

/**
 * Deletes a feature flag.
 */
async function deleteFlag(db, redis, flagId) {
    const flag = await db('feature_flags').where({ id: flagId }).first();
    if (!flag) throw new NotFoundError('Feature Flag', flagId);
    await db('feature_flags').where({ id: flagId }).del();
    await redis.del(`${FLAG_CACHE_PREFIX}${flag.key}`);
}

/**
 * Evaluates a feature flag for a given context.
 */
async function evaluateFlag(db, redis, key, context = {}) {
    // Check cache first
    const cached = await redis.get(`${FLAG_CACHE_PREFIX}${key}`);
    let flag;

    if (cached) {
        flag = JSON.parse(cached);
    } else {
        flag = await db('feature_flags').where({ key }).first();
        if (!flag) return { enabled: false, reason: 'flag_not_found' };
        await redis.setex(`${FLAG_CACHE_PREFIX}${key}`, FLAG_CACHE_TTL, JSON.stringify(flag));
    }

    // Global scope — just check enabled
    if (flag.scope === 'global') {
        return { enabled: flag.enabled, reason: 'global' };
    }

    // Tenant scope — check conditions
    if (flag.scope === 'tenant' && context.tenant_id) {
        const tenantIds = flag.conditions?.tenant_ids || [];
        if (tenantIds.includes(context.tenant_id)) {
            return { enabled: true, reason: 'tenant_match' };
        }
        return { enabled: flag.enabled, reason: 'tenant_default' };
    }

    // Plan scope — check plan
    if (flag.scope === 'plan' && context.plan) {
        const plans = flag.conditions?.plans || [];
        if (plans.includes(context.plan)) {
            return { enabled: true, reason: 'plan_match' };
        }
        return { enabled: false, reason: 'plan_no_match' };
    }

    return { enabled: flag.enabled, reason: 'default' };
}

module.exports = { listFlags, createFlag, updateFlag, deleteFlag, evaluateFlag };
