'use strict';

/**
 * Returns dashboard analytics overview for a tenant.
 */
async function getDashboard(db, redis, tenantId, query = {}) {
    const days = parseInt(query.days || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalQueries] = await db('messages')
        .where('tenant_id', tenantId)
        .where('role', 'user')
        .where('created_at', '>=', since)
        .count('* as count');

    const [totalSessions] = await db('sessions')
        .where('tenant_id', tenantId)
        .where('started_at', '>=', since)
        .count('* as count');

    const [avgLatency] = await db('messages')
        .where('tenant_id', tenantId)
        .where('role', 'assistant')
        .where('created_at', '>=', since)
        .avg('latency_ms as avg_latency');

    const dailyQueries = await db('messages')
        .where('tenant_id', tenantId)
        .where('role', 'user')
        .where('created_at', '>=', since)
        .select(db.raw("DATE(created_at) as date"))
        .count('* as count')
        .groupByRaw('DATE(created_at)')
        .orderBy('date', 'asc');

    return {
        period_days: days,
        total_queries: parseInt(totalQueries.count || '0', 10),
        total_sessions: parseInt(totalSessions.count || '0', 10),
        avg_latency_ms: Math.round(parseFloat(avgLatency.avg_latency || '0')),
        daily_queries: dailyQueries.map((d) => ({ date: d.date, count: parseInt(d.count, 10) })),
    };
}

/**
 * Returns detailed query analytics.
 */
async function getQueryAnalytics(db, tenantId, query = {}) {
    const limit = parseInt(query.limit || '50', 10);
    const offset = parseInt(query.offset || '0', 10);

    const queries = await db('messages')
        .join('sessions', 'messages.session_id', 'sessions.id')
        .where('messages.tenant_id', tenantId)
        .where('messages.role', 'user')
        .select(
            'messages.id',
            'messages.content as question',
            'messages.page_url',
            'messages.created_at',
            'sessions.website_id',
        )
        .orderBy('messages.created_at', 'desc')
        .limit(limit)
        .offset(offset);

    return { queries, limit, offset };
}

/**
 * Returns the most frequently asked questions.
 */
async function getTopQuestions(db, tenantId, query = {}) {
    const days = parseInt(query.days || '30', 10);
    const limit = parseInt(query.limit || '20', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const questions = await db('messages')
        .where('tenant_id', tenantId)
        .where('role', 'user')
        .where('created_at', '>=', since)
        .select('content')
        .count('* as count')
        .groupBy('content')
        .orderBy('count', 'desc')
        .limit(limit);

    return questions.map((q) => ({ question: q.content, count: parseInt(q.count, 10) }));
}

/**
 * Tracks an analytics event (typically called by other services).
 */
async function trackEvent(db, event) {
    // In production, this would publish to SQS for async processing
    // For now, direct insert
    if (event.type === 'query') {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        await db('usage_records')
            .insert({
                tenant_id: event.tenant_id,
                period_start: periodStart,
                period_end: periodEnd,
                query_count: 1,
                token_count: event.tokens || 0,
            })
            .onConflict(['tenant_id', 'period_start'])
            .merge({
                query_count: db.raw('usage_records.query_count + 1'),
                token_count: db.raw('usage_records.token_count + ?', [event.tokens || 0]),
            });
    }
}

module.exports = { getDashboard, getQueryAnalytics, getTopQuestions, trackEvent };
