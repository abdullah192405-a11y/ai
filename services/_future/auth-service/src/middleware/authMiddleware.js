'use strict';

const { verifyAccessToken } = require('../services/authService');
const { AuthenticationError, AuthorizationError } = require('../../../shared/errors');
const { ROLE_HIERARCHY } = require('../../../shared/constants');

/**
 * JWT authentication middleware.
 * Extracts and verifies JWT from Authorization header.
 */
async function verifyJWT(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token);

    request.user = {
        id: decoded.sub,
        tenant_id: decoded.tenant_id,
        role: decoded.role,
        email: decoded.email,
    };
}

/**
 * Role-based authorization middleware factory.
 * Returns a middleware that checks if the user has the required minimum role.
 */
function requireRole(minimumRole) {
    return async (request, reply) => {
        if (!request.user) {
            throw new AuthenticationError('Authentication required');
        }

        const userLevel = ROLE_HIERARCHY[request.user.role] || 0;
        const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

        if (userLevel < requiredLevel) {
            throw new AuthorizationError(
                `Role '${request.user.role}' does not have sufficient permissions. Required: '${minimumRole}'`,
            );
        }
    };
}

/**
 * Scope-based authorization middleware factory.
 * Checks if the API key has the required scope.
 */
function requireScope(scope) {
    return async (request, reply) => {
        if (!request.apiKey) {
            throw new AuthenticationError('API key required');
        }

        if (!request.apiKey.scopes.includes(scope)) {
            throw new AuthorizationError(`API key does not have required scope: ${scope}`);
        }
    };
}

module.exports = { verifyJWT, requireRole, requireScope };
