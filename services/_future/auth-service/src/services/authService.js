'use strict';

const jwt = require('jsonwebtoken');
const { v7: uuidv7 } = require('uuid');
const { hashPassword, verifyPassword } = require('../../../shared/utils/crypto');
const {
    AuthenticationError,
    ConflictError,
    NotFoundError,
} = require('../../../shared/errors');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const ISSUER = process.env.JWT_ISSUER || 'wba-auth';

/**
 * Generates JWT access + refresh token pair.
 */
function generateTokens(user) {
    const payload = {
        sub: user.id,
        tenant_id: user.tenant_id,
        role: user.role,
        email: user.email,
    };

    const access_token = jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY,
        issuer: ISSUER,
        jwtid: uuidv7(),
    });

    const refresh_token = jwt.sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY,
        issuer: ISSUER,
        jwtid: uuidv7(),
    });

    return {
        access_token,
        refresh_token,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes in seconds
    };
}

/**
 * Registers a new tenant and owner user.
 */
async function register(db, { email, password, orgName }) {
    // Check for existing user
    const existing = await db('tenants').where({ email }).first();
    if (existing) {
        throw new ConflictError('An account with this email already exists');
    }

    const tenantId = uuidv7();
    const userId = uuidv7();
    const passwordHash = await hashPassword(password);

    await db.transaction(async (trx) => {
        // Create tenant
        await trx('tenants').insert({
            id: tenantId,
            name: orgName,
            email,
            plan: 'free',
            status: 'active',
        });

        // Create owner user
        await trx('users').insert({
            id: userId,
            tenant_id: tenantId,
            email,
            password_hash: passwordHash,
            role: 'tenant_owner',
            status: 'active',
        });
    });

    const user = { id: userId, tenant_id: tenantId, role: 'tenant_owner', email };
    const tokens = generateTokens(user);

    return {
        ...tokens,
        user: {
            id: userId,
            tenant_id: tenantId,
            email,
            role: 'tenant_owner',
        },
    };
}

/**
 * Authenticates a user and returns JWT tokens.
 */
async function login(db, { email, password }) {
    const user = await db('users')
        .join('tenants', 'users.tenant_id', 'tenants.id')
        .where('users.email', email)
        .where('users.status', 'active')
        .select(
            'users.id',
            'users.tenant_id',
            'users.email',
            'users.password_hash',
            'users.role',
            'tenants.status as tenant_status',
        )
        .first();

    if (!user) {
        throw new AuthenticationError('Invalid email or password');
    }

    if (user.tenant_status !== 'active') {
        throw new AuthenticationError('Account is suspended');
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
        throw new AuthenticationError('Invalid email or password');
    }

    // Update last login
    await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    const tokens = generateTokens(user);

    return {
        ...tokens,
        user: {
            id: user.id,
            tenant_id: user.tenant_id,
            email: user.email,
            role: user.role,
        },
    };
}

/**
 * Refreshes an access token using a valid refresh token.
 */
async function refreshToken(token) {
    try {
        const decoded = jwt.verify(token, REFRESH_SECRET, { issuer: ISSUER });

        if (decoded.type !== 'refresh') {
            throw new AuthenticationError('Invalid token type');
        }

        // Generate new token pair (refresh token rotation)
        const newPayload = {
            sub: decoded.sub,
            tenant_id: decoded.tenant_id,
            role: decoded.role,
            email: decoded.email,
        };

        return {
            access_token: jwt.sign(newPayload, ACCESS_SECRET, {
                expiresIn: ACCESS_EXPIRY,
                issuer: ISSUER,
                jwtid: uuidv7(),
            }),
            refresh_token: jwt.sign({ sub: decoded.sub, type: 'refresh' }, REFRESH_SECRET, {
                expiresIn: REFRESH_EXPIRY,
                issuer: ISSUER,
                jwtid: uuidv7(),
            }),
            token_type: 'Bearer',
            expires_in: 900,
        };
    } catch (err) {
        if (err instanceof AuthenticationError) throw err;
        throw new AuthenticationError('Invalid or expired refresh token');
    }
}

/**
 * Verifies a JWT access token and returns the decoded payload.
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, ACCESS_SECRET, { issuer: ISSUER });
    } catch {
        throw new AuthenticationError('Invalid or expired access token');
    }
}

module.exports = { register, login, refreshToken, verifyAccessToken, generateTokens };
