'use strict';

const { v7: uuidv7 } = require('uuid');
const { generateApiKey, hashApiKey, getKeyPrefix } = require('../../../shared/utils/crypto');
const { NotFoundError, AuthenticationError } = require('../../../shared/errors');
const { cacheGetOrSet } = require('../../../shared/utils/redis');

const CACHE_TTL = parseInt(process.env.API_KEY_CACHE_TTL || '300', 10);

/**
 * Creates a new API key for a tenant.
 * Returns the full key ONCE — only the hash is stored.
 */
async function createApiKey(db, { tenantId, name, scopes, website_id, expires_in_days }) {
    const id = uuidv7();
    const rawKey = generateApiKey(tenantId);
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
        : null;

    await db('api_keys').insert({
        id,
        tenant_id: tenantId,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
        scopes: scopes || ['read:assistant'],
        website_id: website_id || null,
        expires_at: expiresAt,
    });

    return {
        id,
        api_key: rawKey, // Shown only once
        key_prefix: keyPrefix,
        name,
        scopes: scopes || ['read:assistant'],
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
    };
}

/**
 * Lists all API keys for a tenant (without showing the raw keys).
 */
async function listApiKeys(db, tenantId) {
    const keys = await db('api_keys')
        .where({ tenant_id: tenantId, revoked: false })
        .select('id', 'key_prefix', 'name', 'scopes', 'website_id', 'last_used_at', 'expires_at', 'created_at')
        .orderBy('created_at', 'desc');

    return keys;
}

/**
 * Revokes an API key and purges it from cache.
 */
async function revokeApiKey(db, redis, { keyId, tenantId }) {
    const key = await db('api_keys')
        .where({ id: keyId, tenant_id: tenantId })
        .first();

    if (!key) {
        throw new NotFoundError('API Key', keyId);
    }

    await db('api_keys').where({ id: keyId }).update({ revoked: true });

    // Purge from cache
    await redis.del(`auth:apikey:${key.key_hash}`);
}

/**
 * Verifies an API key and returns tenant context.
 * Uses Redis cache to avoid DB lookups on every request.
 */
async function verifyApiKey(db, redis, rawKey) {
    const keyHash = hashApiKey(rawKey);

    // Check cache first
    const cached = await redis.get(`auth:apikey:${keyHash}`);
    if (cached) {
        const data = JSON.parse(cached);
        if (data.revoked) {
            throw new AuthenticationError('API key has been revoked');
        }
        // Update last_used_at asynchronously (fire and forget)
        db('api_keys').where({ key_hash: keyHash }).update({ last_used_at: new Date() }).catch(() => { });
        return data;
    }

    // Cache miss — query DB
    const key = await db('api_keys')
        .join('tenants', 'api_keys.tenant_id', 'tenants.id')
        .where('api_keys.key_hash', keyHash)
        .select(
            'api_keys.id',
            'api_keys.tenant_id',
            'api_keys.scopes',
            'api_keys.website_id',
            'api_keys.revoked',
            'api_keys.expires_at',
            'tenants.plan',
            'tenants.status as tenant_status',
            'tenants.settings as tenant_settings',
        )
        .first();

    if (!key) {
        throw new AuthenticationError('Invalid API key');
    }

    if (key.revoked) {
        throw new AuthenticationError('API key has been revoked');
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
        throw new AuthenticationError('API key has expired');
    }

    if (key.tenant_status !== 'active') {
        throw new AuthenticationError('Tenant account is suspended');
    }

    const result = {
        key_id: key.id,
        tenant_id: key.tenant_id,
        scopes: key.scopes,
        website_id: key.website_id,
        plan: key.plan,
        tenant_status: key.tenant_status,
        revoked: false,
    };

    // Cache the result
    await redis.setex(`auth:apikey:${keyHash}`, CACHE_TTL, JSON.stringify(result));

    // Update last_used_at asynchronously
    db('api_keys').where({ key_hash: keyHash }).update({ last_used_at: new Date() }).catch(() => { });

    return result;
}

module.exports = { createApiKey, listApiKeys, revokeApiKey, verifyApiKey };
