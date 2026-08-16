import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  FileText,
  Users,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../api';
import ChartTip from '@wba/dashboard-ui/ChartTip';
import LoadingState from '../components/LoadingState';
import NoWebsitePrompt from '../components/NoWebsitePrompt';
import { useTenantWebsites } from '../hooks/useTenantWebsites';
import { needsOwnershipVerify } from '../lib/websiteOwnership';

function Spark({ data, color = 'var(--accent)' }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="sparkline">
      {data.map((v, i) => (
        <div
          key={i}
          className="sparkline-bar"
          style={{
            height: `${(v / max) * 100}%`,
            background: color,
            opacity: i === data.length - 1 ? 1 : 0.4 + (i / data.length) * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function normalizeSatisfaction(items) {
  if (!items?.length) return [];
  const total = items.reduce((sum, d) => sum + (d.value ?? 0), 0);
  return items.map((d) => ({
    label: d.label ?? d.name ?? '—',
    value: total ? Math.round(((d.value ?? 0) / total) * 100) : 0,
    color: d.color,
    count: d.value ?? 0,
  }));
}

function normalizeChannelData(items) {
  if (!items?.length) return [];
  const total = items.reduce((sum, c) => sum + (c.queries ?? c.value ?? 0), 0);
  return items.map((c) => ({
    channel: c.channel ?? c.name ?? '—',
    queries: c.queries ?? c.value ?? 0,
    pct: c.pct ?? (total ? Math.round(((c.queries ?? c.value ?? 0) / total) * 100) : 0),
  }));
}

export default function Overview({ user }) {
  const { active: website } = useTenantWebsites(user);
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getOverview(), api.getAnalytics('7d')])
      .then(([overview, stats]) => {
        setData(overview);
        setAnalytics(stats);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.websiteId]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="card">
        <div className="card-body" style={{ color: '#f87171' }}>{error}</div>
      </div>
    );
  }

  const noWebsite = !data?.websites;
  const kpis = analytics?.kpis ?? {};
  const dailyQueries = analytics?.dailyQueries ?? [];
  const querySpark = dailyQueries.map((d) => d.queries ?? 0);
  const satisfactionData = normalizeSatisfaction(analytics?.satisfactionData);
  const channelData = normalizeChannelData(analytics?.channelData);
  const topQuestions = analytics?.topQuestions ?? [];

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>الرئيسية</h1>
          <p>
            {noWebsite ? 'مرحباً — سجّل موقعك للبدء' : 'ملخص سريع لأداء المساعد على موقعك'}
          </p>
        </div>
        {!noWebsite && (
          <div className="topbar-right">
            <Link to="/install" className="btn btn-primary btn-sm">
              ثبّت على الموقع
            </Link>
          </div>
        )}
      </div>

      {noWebsite ? (
        <NoWebsitePrompt title="مرحباً! ابدأ بإضافة موقعك" />
      ) : (
        <>
          {needsOwnershipVerify(website) && (
            <div className="card anim-in" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text-2)' }}>
                  أثبت ملكية <code style={{ direction: 'ltr' }}>{website.domain}</code> قبل زحف الموقع.
                </div>
                <Link to="/websites" className="btn btn-primary btn-sm">
                  إكمال التحقق
                </Link>
              </div>
            </div>
          )}
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              {
                icon: MessageSquare,
                label: 'استعلامات (٧ أيام)',
                val: (kpis.queries?.value ?? 0).toLocaleString('ar-SA'),
                delta: kpis.queries?.delta ?? 0,
                spark: querySpark,
                color: 'purple',
              },
              {
                icon: Clock,
                label: 'سرعة الرد',
                val: `${kpis.latency?.value ?? 0}ms`,
                delta: kpis.latency?.delta ?? 0,
                color: 'green',
              },
              {
                icon: ThumbsUp,
                label: 'الرضا',
                val: `${kpis.satisfaction?.value ?? 0}٪`,
                delta: kpis.satisfaction?.delta ?? 0,
                color: 'amber',
              },
              {
                icon: Zap,
                label: 'جلسات اليوم',
                val: Number(data.queries_today || 0).toLocaleString('ar-SA'),
                color: 'cyan',
              },
            ].map((s, i) => (
              <div key={i} className={`stat-card st-${s.color} anim-in`}>
                <div className="stat-top">
                  <div className={`stat-icon ${s.color}`}>
                    <s.icon size={17} />
                  </div>
                  {s.spark?.length > 0 && (
                    <Spark
                      data={s.spark}
                      color={`var(--${s.color === 'purple' ? 'accent' : s.color})`}
                    />
                  )}
                </div>
                <div className="stat-val">{s.val}</div>
                <div className="stat-label">{s.label}</div>
                {s.delta != null && (
                  <div className={`stat-delta ${s.delta > 0 ? 'up' : 'down'}`}>
                    {s.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(s.delta)}٪
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 0, marginBottom: 20 }}>
            {[
              { icon: Users, label: 'جلسات الأسبوع', val: data.queries_week, color: 'green' },
              { icon: FileText, label: 'المستندات', val: data.documents, color: 'amber' },
              {
                icon: MessageSquare,
                label: 'إجمالي المحادثات',
                val: data.total_conversations,
                color: 'green',
              },
            ].map((s, i) => (
              <div key={i} className={`stat-card st-${s.color} anim-in`} style={{ cursor: 'default' }}>
                <div className="stat-top">
                  <div className={`stat-icon ${s.color}`}>
                    <s.icon size={17} />
                  </div>
                </div>
                <div className="stat-val" style={{ fontSize: 22 }}>
                  {Number(s.val || 0).toLocaleString('ar-SA')}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card anim-in" style={{ marginBottom: 20 }}>
            <div className="card-head">
              <h3>الأسئلة خلال ٧ أيام</h3>
            </div>
            <div className="card-body" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyQueries}>
                  <defs>
                    <linearGradient id="gOverviewQ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#006c35" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#006c35" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOverviewS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0a8244" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#0a8244" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                  <XAxis dataKey="date" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                  <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    name="الاستعلامات"
                    stroke="#006c35"
                    strokeWidth={2}
                    fill="url(#gOverviewQ)"
                  />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    name="الجلسات"
                    stroke="#0a8244"
                    strokeWidth={2}
                    fill="url(#gOverviewS)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid-2-1">
            <div className="card anim-in">
              <div className="card-head">
                <h3>أكثر الأسئلة شيوعاً</h3>
              </div>
              <div className="card-body">
                {topQuestions.slice(0, 5).map((q, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: i < Math.min(topQuestions.length, 5) - 1 ? '1px solid var(--border-1)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-muted)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 10,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{q.q}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'var(--mono)' }}>{q.count}</span>
                  </div>
                ))}
                {!topQuestions.length && (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
                    لا توجد استعلامات بعد — ستظهر الرسوم البيانية عند بدء المحادثات
                  </p>
                )}
              </div>
            </div>

            <div className="card anim-in">
              <div className="card-head">
                <h3>رضا المستخدمين</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={satisfactionData}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={38}
                        outerRadius={58}
                        paddingAngle={3}
                      >
                        {satisfactionData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1 }}>
                  {satisfactionData.length ? (
                    satisfactionData.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 0',
                          borderBottom:
                            i < satisfactionData.length - 1 ? '1px solid var(--border-1)' : 'none',
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: d.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{d.label}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--mono)' }}>
                          {d.value}٪
                        </span>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>لا توجد تقييمات بعد</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 20 }}>
            <div className="card anim-in">
              <div className="card-head">
                <h3>الاستخدام حسب النموذج</h3>
              </div>
              <div className="card-body">
                {channelData.map((c, i) => (
                  <div key={i} style={{ marginBottom: i < channelData.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.channel}</span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                        {c.queries.toLocaleString('ar-SA')}{' '}
                        <span style={{ color: 'var(--text-4)' }}>({c.pct}٪)</span>
                      </span>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                      <div className="progress-fill purple" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card anim-in">
              <div className="card-head">
                <h3>الخطوات التالية</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { to: '/install', label: 'ثبّت المساعد على سلة أو موقعك' },
                  { to: '/knowledge-base', label: 'علّم المساعد محتوى متجرك' },
                  { to: '/customize', label: 'غيّر اللون ورسالة الترحيب' },
                ].map((step) => (
                  <Link
                    key={step.to}
                    to={step.to}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border-1)',
                      color: 'var(--text-1)',
                      textDecoration: 'none',
                      fontSize: 13.5,
                      fontWeight: 600,
                    }}
                  >
                    {step.label}
                    <ArrowLeft size={14} style={{ color: 'var(--text-4)' }} />
                  </Link>
                ))}
                <Link to="/conversations" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
                  <MessageSquare size={14} /> عرض المحادثات (
                  {Number(data.total_conversations || 0).toLocaleString('ar-SA')})
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
