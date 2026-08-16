'use strict';

const { v7: uuidv7 } = require('uuid');
const crypto = require('crypto');
const dns = require('dns').promises;
const { NotFoundError, ConflictError, ValidationError } = require('../../../shared/errors');

/**
 * Registers a new website for a tenant.
 */
async function registerWebsite(db, { tenantId, domain, settings }) {
    // Normalize domain (strip protocol, www, trailing slash)
    const normalizedDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase();

    // Check for existing registration
    const existing = await db('websites').where({ tenant_id: tenantId, domain: normalizedDomain }).first();
    if (existing) {
        throw new ConflictError(`Domain '${normalizedDomain}' is already registered`);
    }

    const id = uuidv7();
    const verificationToken = `wba-verify=${crypto.randomBytes(24).toString('hex')}`;

    const [website] = await db('websites')
        .insert({
            id,
            tenant_id: tenantId,
            domain: normalizedDomain,
            verification_token: verificationToken,
            settings: settings || {},
            status: 'pending',
        })
        .returning('*');

    return {
        ...website,
        verification_instructions: {
            method: 'dns_txt',
            record_type: 'TXT',
            record_name: normalizedDomain,
            record_value: verificationToken,
            alternative_method: 'meta_tag',
            meta_tag: `<meta name="wba-verification" content="${verificationToken}" />`,
        },
    };
}

/**
 * Lists all websites for a tenant.
 */
async function listWebsites(db, tenantId) {
    return db('websites')
        .where({ tenant_id: tenantId })
        .select('*')
        .orderBy('created_at', 'desc');
}

/**
 * Gets a single website by ID.
 */
async function getWebsite(db, tenantId, websiteId) {
    const website = await db('websites')
        .where({ id: websiteId, tenant_id: tenantId })
        .first();
    if (!website) throw new NotFoundError('Website', websiteId);
    return website;
}

/**
 * Attempts to verify domain ownership via DNS TXT record.
 */
async function verifyDomain(db, tenantId, websiteId) {
    const website = await getWebsite(db, tenantId, websiteId);

    if (website.verified) {
        return { verified: true, message: 'Domain is already verified' };
    }

    try {
        const records = await dns.resolveTxt(website.domain);
        const flatRecords = records.map((r) => r.join('')).flat();
        const found = flatRecords.some((r) => r === website.verification_token);

        if (found) {
            await db('websites')
                .where({ id: websiteId })
                .update({ verified: true, status: 'active' });
            return { verified: true, message: 'Domain verified successfully!' };
        }

        return {
            verified: false,
            message: 'Verification token not found in DNS TXT records. Please ensure the record has propagated.',
        };
    } catch (err) {
        return {
            verified: false,
            message: `DNS lookup failed: ${err.code || err.message}. Please check your DNS configuration.`,
        };
    }
}

/**
 * Deletes a website and its associated data.
 */
async function deleteWebsite(db, tenantId, websiteId) {
    const website = await getWebsite(db, tenantId, websiteId);
    await db('websites').where({ id: websiteId, tenant_id: tenantId }).del();
}

module.exports = { registerWebsite, listWebsites, getWebsite, verifyDomain, deleteWebsite };
