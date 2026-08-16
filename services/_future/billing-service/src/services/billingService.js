'use strict';

const Stripe = require('stripe');
const { PLANS } = require('../../../shared/constants');
const { NotFoundError, AppError } = require('../../../shared/errors');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

const PRICE_IDS = {
    starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly',
    starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL || 'price_starter_annual',
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual',
    enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
    enterprise_annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || 'price_enterprise_annual',
};

/**
 * Gets the current plan and quota for a tenant.
 */
async function getCurrentPlan(db, tenantId) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const planConfig = PLANS[tenant.plan] || PLANS.free;

    return {
        plan: tenant.plan,
        plan_name: planConfig.name,
        limits: {
            max_websites: planConfig.maxWebsites,
            max_queries_per_month: planConfig.maxQueriesPerMonth,
            max_documents: planConfig.maxDocuments,
            max_storage_bytes: planConfig.maxStorageBytes,
        },
        features: planConfig.features,
        models: planConfig.models,
    };
}

/**
 * Creates a Stripe Checkout Session for plan upgrade.
 */
async function createCheckoutSession(db, tenantId, { plan, billing_cycle }) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    let customerId = tenant.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: tenant.email,
            metadata: { tenant_id: tenantId },
        });
        customerId = customer.id;
        await db('tenants').where({ id: tenantId }).update({ stripe_customer_id: customerId });
    }

    const priceKey = `${plan}_${billing_cycle || 'monthly'}`;
    const priceId = PRICE_IDS[priceKey];
    if (!priceId) throw new AppError(`Invalid plan/billing combination: ${priceKey}`, 400);

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing/cancel`,
        metadata: { tenant_id: tenantId, plan },
    });

    return { checkout_url: session.url, session_id: session.id };
}

/**
 * Gets usage summary for the current billing period.
 */
async function getUsageSummary(db, redis, tenantId) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await db('usage_records')
        .where({ tenant_id: tenantId })
        .where('period_start', '>=', periodStart)
        .first();

    // Also get real-time token count from Redis
    const realtimeTokens = await redis.hget(`usage:${tenantId}`, 'total_tokens');

    const tenant = await db('tenants').where({ id: tenantId }).first();
    const planConfig = PLANS[tenant?.plan || 'free'] || PLANS.free;

    return {
        period_start: periodStart.toISOString(),
        period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
        queries: usage?.query_count || 0,
        tokens: parseInt(realtimeTokens || '0', 10) + (usage?.token_count || 0),
        documents: usage?.document_count || 0,
        storage_bytes: usage?.storage_bytes || 0,
        limits: {
            max_queries: planConfig.maxQueriesPerMonth,
            max_documents: planConfig.maxDocuments,
            max_storage_bytes: planConfig.maxStorageBytes,
        },
    };
}

/**
 * Gets invoice history from Stripe.
 */
async function getInvoices(db, tenantId) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant?.stripe_customer_id) return [];

    try {
        const invoices = await stripe.invoices.list({
            customer: tenant.stripe_customer_id,
            limit: 20,
        });

        return invoices.data.map((inv) => ({
            id: inv.id,
            amount: inv.amount_due,
            currency: inv.currency,
            status: inv.status,
            period_start: new Date(inv.period_start * 1000).toISOString(),
            period_end: new Date(inv.period_end * 1000).toISOString(),
            invoice_url: inv.hosted_invoice_url,
            pdf_url: inv.invoice_pdf,
        }));
    } catch {
        return [];
    }
}

/**
 * Cancels the tenant's subscription at period end.
 */
async function cancelSubscription(db, tenantId) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant?.stripe_customer_id) {
        throw new AppError('No active subscription found', 400);
    }

    const subscriptions = await stripe.subscriptions.list({
        customer: tenant.stripe_customer_id,
        status: 'active',
        limit: 1,
    });

    if (!subscriptions.data.length) {
        throw new AppError('No active subscription found', 400);
    }

    await stripe.subscriptions.update(subscriptions.data[0].id, {
        cancel_at_period_end: true,
    });

    return { message: 'Subscription will cancel at the end of the current billing period' };
}

/**
 * Handles Stripe webhook events.
 */
async function handleStripeWebhook(db, rawBody, signature) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const tenantId = session.metadata?.tenant_id;
            const plan = session.metadata?.plan;
            if (tenantId && plan) {
                await db('tenants').where({ id: tenantId }).update({ plan, updated_at: new Date() });
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const customer = await stripe.customers.retrieve(subscription.customer);
            const tenantId = customer.metadata?.tenant_id;
            if (tenantId) {
                await db('tenants').where({ id: tenantId }).update({ plan: 'free', updated_at: new Date() });
            }
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            // TODO: Send notification to tenant about failed payment
            break;
        }
    }
}

module.exports = { getCurrentPlan, createCheckoutSession, getUsageSummary, getInvoices, cancelSubscription, handleStripeWebhook };
