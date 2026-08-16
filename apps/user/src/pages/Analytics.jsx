import { useState, useEffect } from 'react'
import {
    BarChart3, TrendingUp, TrendingDown, Clock, ThumbsUp,
    MessageSquare, Users, Zap,
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { api } from '../api'
import ChartTip from '@wba/dashboard-ui/ChartTip'
import LoadingState from '../components/LoadingState'
import WebsiteSwitcher from '../components/WebsiteSwitcher'
import ActiveWebsiteScope from '../components/ActiveWebsiteScope'

const emptyKpis = {
    queries: { value: 0, delta: 0 },
    latency: { value: 0, delta: 0 },
    satisfaction: { value: 0, delta: 0 },
    resolved: { value: 0, delta: 0 },
}

function normalizeChannelData(items) {
    if (!items?.length) return []
    const total = items.reduce((sum, c) => sum + (c.queries ?? c.value ?? 0), 0)
    return items.map((c) => {
        const queries = c.queries ?? c.value ?? 0
        return {
            channel: c.channel ?? c.name ?? '—',
            queries,
            pct: c.pct ?? (total ? Math.round((queries / total) * 100) : 0),
        }
    })
}

function normalizeSatisfaction(items) {
    if (!items?.length) return []
    const total = items.reduce((sum, d) => sum + (d.value ?? 0), 0)
    return items.map((d) => ({
        label: d.label ?? d.name ?? '—',
        value: total ? Math.round(((d.value ?? 0) / total) * 100) : 0,
        color: d.color,
        count: d.value ?? 0,
    }))
}

export default function Analytics({ user }) {
    const [period, setPeriod] = useState('30d')
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState(null)

    useEffect(() => {
        setLoading(true)
        api.getAnalytics(period)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false))
    }, [period, user?.websiteId])

    const kpis = data?.kpis ?? emptyKpis
    const dailyQueries = data?.dailyQueries ?? []
    const topQuestions = data?.topQuestions ?? []
    const responseTimeData = (data?.responseTimeData ?? []).map((r) => ({
        ...r,
        h: r.h ?? r.date,
    }))
    const satisfactionData = normalizeSatisfaction(data?.satisfactionData)
    const channelData = normalizeChannelData(data?.channelData)

    const lastRt = responseTimeData[responseTimeData.length - 1]

    if (loading) return <LoadingState />

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>الإحصائيات</h1>
                    <p>كم سأل الزوار، وما أكثر الأسئلة، وهل كانوا راضين</p>
                </div>
                <div className="topbar-right">
                    <WebsiteSwitcher user={user} />
                    <div style={{ display: 'flex', gap: 0, background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)', overflow: 'hidden' }}>
                        {[
                            { id: '7d', label: '٧ أيام' },
                            { id: '30d', label: '٣٠ يوم' },
                            { id: '90d', label: '٩٠ يوم' },
                        ].map(p => (
                            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                                padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
                                background: period === p.id ? 'var(--accent)' : 'transparent',
                                color: period === p.id ? '#fff' : 'var(--text-3)',
                                border: 'none', cursor: 'pointer', transition: 'all 150ms',
                            }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <ActiveWebsiteScope user={user} />

            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                    { icon: MessageSquare, label: 'إجمالي الاستعلامات', val: (kpis.queries?.value ?? 0).toLocaleString('ar-SA'), delta: kpis.queries?.delta ?? 0, color: 'purple' },
                    { icon: Clock, label: 'متوسط التأخير', val: `${kpis.latency?.value ?? 0}ms`, delta: kpis.latency?.delta ?? 0, color: 'green' },
                    { icon: ThumbsUp, label: 'الرضا', val: `${kpis.satisfaction?.value ?? 0}٪`, delta: kpis.satisfaction?.delta ?? 0, color: 'amber' },
                    { icon: Zap, label: 'نسبة الحل', val: `${kpis.resolved?.value ?? 0}٪`, delta: kpis.resolved?.delta ?? 0, color: 'cyan' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={17} /></div></div>
                        <div className="stat-val">{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                        <div className={`stat-delta ${s.delta > 0 ? 'up' : 'down'}`}>
                            {s.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(s.delta)}٪
                        </div>
                    </div>
                ))}
            </div>

            <div className="card anim-in" style={{ marginBottom: 20 }}>
                <div className="card-head">
                    <h3>اتجاه حجم الاستعلامات</h3>
                    <span className="badge badge-purple"><span className="dot" /> مباشر</span>
                </div>
                <div className="card-body" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyQueries}>
                            <defs>
                                <linearGradient id="gA2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#006c35" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="#006c35" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gS2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0a8244" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#0a8244" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                            <XAxis dataKey="date" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                            <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" />
                            <Tooltip content={<ChartTip />} />
                            <Area type="monotone" dataKey="queries" name="الاستعلامات" stroke="#006c35" strokeWidth={2} fill="url(#gA2)" />
                            <Area type="monotone" dataKey="sessions" name="الجلسات" stroke="#0a8244" strokeWidth={2} fill="url(#gS2)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2">
                <div className="card anim-in">
                    <div className="card-head">
                        <h3>النسب المئوية لوقت الاستجابة</h3>
                    </div>
                    <div className="card-body" style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={responseTimeData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                <XAxis dataKey="h" stroke="var(--text-4)" fontSize={11} tickLine={false} />
                                <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} unit="ms" orientation="right" />
                                <Tooltip content={<ChartTip />} />
                                <Line type="monotone" dataKey="p50" name="P50" stroke="#34d399" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="p95" name="P95" stroke="#fbbf24" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="p99" name="P99" stroke="#f87171" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="card-foot" style={{ display: 'flex', gap: 18 }}>
                        {[
                            { label: 'P50', val: lastRt?.p50 != null ? `${lastRt.p50}ms` : '—', color: '#34d399' },
                            { label: 'P95', val: lastRt?.p95 != null ? `${lastRt.p95}ms` : '—', color: '#fbbf24' },
                            { label: 'P99', val: lastRt?.p99 != null ? `${lastRt.p99}ms` : '—', color: '#f87171' },
                        ].map(p => (
                            <span key={p.label} style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color, marginInlineEnd: 5, verticalAlign: -1 }} />
                                {p.label}: <strong style={{ color: 'var(--text-1)' }}>{p.val}</strong>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="card anim-in">
                    <div className="card-head">
                        <h3>رضا المستخدمين</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 160, height: 160 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={satisfactionData} dataKey="count" nameKey="label" innerRadius={45} outerRadius={70} paddingAngle={3}>
                                        {satisfactionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1 }}>
                            {satisfactionData.map((d, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                                    borderBottom: i < satisfactionData.length - 1 ? '1px solid var(--border-1)' : 'none',
                                }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{d.label}</span>
                                    <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--mono)' }}>{d.value}٪</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="card anim-in">
                    <div className="card-head">
                        <h3>حركة المرور حسب القناة</h3>
                    </div>
                    <div className="card-body">
                        {channelData.map((c, i) => (
                            <div key={i} style={{ marginBottom: i < channelData.length - 1 ? 16 : 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.channel}</span>
                                    <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{c.queries.toLocaleString('ar-SA')} <span style={{ color: 'var(--text-4)' }}>({c.pct}٪)</span></span>
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
                        <h3>أكثر الأسئلة شيوعاً</h3>
                    </div>
                    <div className="card-body">
                        {topQuestions.slice(0, 5).map((q, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                                borderBottom: i < 4 ? '1px solid var(--border-1)' : 'none',
                            }}>
                                <span style={{
                                    width: 20, height: 20, borderRadius: 'var(--radius-full)',
                                    background: 'var(--accent-muted)', color: 'var(--accent)',
                                    display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0,
                                }}>{i + 1}</span>
                                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{q.q}</span>
                                <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'var(--mono)' }}>{q.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
