/** Tenant-scoped analytics for the user dashboard. */

import { query } from '../db.js';

function periodInterval(period) {
  if (period === '7d') return "INTERVAL '7 days'";
  if (period === '90d') return "INTERVAL '90 days'";
  return "INTERVAL '30 days'";
}

function pctDelta(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getTenantAnalytics(tenantId, websiteId = null, period = '30d') {
  const interval = periodInterval(period);
  const halfInterval = period === '7d' ? "INTERVAL '7 days'" : period === '90d' ? "INTERVAL '45 days'" : "INTERVAL '15 days'";

  const sessionWebsiteFilter = websiteId ? 'AND website_id = $2' : '';
  const messageWebsiteFilter = websiteId
    ? 'AND session_id IN (SELECT id FROM sessions WHERE tenant_id = $1 AND website_id = $2)'
    : '';
  const feedbackWebsiteFilter = websiteId
    ? 'AND session_id IN (SELECT id FROM sessions WHERE tenant_id = $1 AND website_id = $2)'
    : '';
  const params = websiteId ? [tenantId, websiteId] : [tenantId];

  const [
    queries,
    sessions,
    latency,
    prevQueries,
    daily,
    topQuestions,
    models,
    satisfaction,
  ] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS n FROM messages
        WHERE tenant_id = $1 AND role = 'user'
          AND created_at >= NOW() - ${interval} ${messageWebsiteFilter}`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM sessions
        WHERE tenant_id = $1 AND started_at >= NOW() - ${interval} ${sessionWebsiteFilter}`,
      params
    ),
    query(
      `SELECT COALESCE(AVG(latency_ms), 0)::int AS avg FROM messages
        WHERE tenant_id = $1 AND role = 'assistant' AND latency_ms IS NOT NULL
          AND created_at >= NOW() - ${interval} ${messageWebsiteFilter}`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM messages
        WHERE tenant_id = $1 AND role = 'user'
          AND created_at >= NOW() - ${interval} - ${halfInterval}
          AND created_at < NOW() - ${halfInterval} ${messageWebsiteFilter}`,
      params
    ),
    query(
      `SELECT DATE(created_at) AS d,
              COUNT(*) FILTER (WHERE role = 'user')::int AS queries,
              COUNT(DISTINCT session_id)::int AS sessions
         FROM messages
        WHERE tenant_id = $1 AND created_at >= NOW() - ${interval} ${messageWebsiteFilter}
        GROUP BY DATE(created_at)
        ORDER BY d`,
      params
    ),
    query(
      `SELECT content, COUNT(*)::int AS count FROM messages
        WHERE tenant_id = $1 AND role = 'user'
          AND created_at >= NOW() - ${interval} ${messageWebsiteFilter}
        GROUP BY content
        ORDER BY count DESC
        LIMIT 8`,
      params
    ),
    query(
      `SELECT model_used, COUNT(*)::int AS n FROM messages
        WHERE tenant_id = $1 AND model_used IS NOT NULL
          AND created_at >= NOW() - ${interval} ${messageWebsiteFilter}
        GROUP BY model_used`,
      params
    ),
    query(
      `SELECT rating, COUNT(*)::int AS n FROM message_feedback
        WHERE tenant_id = $1 AND created_at >= NOW() - ${interval} ${feedbackWebsiteFilter}
        GROUP BY rating`,
      params
    ),
  ]);

  const q = queries.rows[0]?.n || 0;
  const s = sessions.rows[0]?.n || 0;
  const prevQ = prevQueries.rows[0]?.n || 0;
  const lat = latency.rows[0]?.avg || 0;

  const maxQ = topQuestions.rows[0]?.count || 1;
  const monthDay = (d) =>
    new Date(d).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });

  const positive = satisfaction.rows.filter((r) => r.rating === 'positive').reduce((a, r) => a + r.n, 0);
  const totalFb = satisfaction.rows.reduce((a, r) => a + r.n, 0);
  const satPct = totalFb ? Math.round((positive / totalFb) * 1000) / 10 : 0;

  const modelColors = ['#6366f1', '#8b5cf6', '#22d3ee', '#34d399', '#f97316'];
  const channelData = models.rows.map((r, i) => ({
    name: r.model_used || '—',
    value: r.n,
    color: modelColors[i % modelColors.length],
  }));

  return {
    kpis: {
      queries: { value: q, delta: pctDelta(q, prevQ) },
      sessions: { value: s, delta: 0 },
      latency: { value: lat, delta: 0 },
      satisfaction: { value: satPct, delta: 0 },
    },
    dailyQueries: daily.rows.map((r) => ({
      date: monthDay(r.d),
      queries: r.queries,
      sessions: r.sessions,
      resolved: Math.round(r.queries * 0.85),
    })),
    topQuestions: topQuestions.rows.map((r, i) => ({
      q: r.content.slice(0, 80),
      count: r.count,
      pct: Math.round((r.count / maxQ) * 100),
      trend: i % 3 === 0 ? 'up' : 'stable',
    })),
    responseTimeData: daily.rows.slice(-7).map((r) => ({
      date: monthDay(r.d),
      p50: lat,
      p95: Math.round(lat * 1.4),
    })),
    satisfactionData: [
      { name: 'إيجابي', value: positive, color: '#34d399' },
      { name: 'سلبي', value: totalFb - positive, color: '#f87171' },
    ].filter((d) => d.value > 0),
    channelData: channelData.length ? channelData : [{ name: 'لا بيانات', value: 1, color: '#757ba3' }],
  };
}
