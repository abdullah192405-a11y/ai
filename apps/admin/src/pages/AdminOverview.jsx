import {
    Users, DollarSign, MessageSquare, TrendingUp, TrendingDown,
    Activity, Zap, Clock, AlertTriangle, CheckCircle2, ArrowLeft,
    Server, Brain, HeadphonesIcon, Globe,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { api } from '../api'
import ChartTip from '@wba/dashboard-ui/ChartTip'

function Spark({ data, color = 'var(--accent)' }) {
    if (!data?.length) return null
    const max = Math.max(...data, 1)
    return (
        <div className="sparkline">
            {data.map((v, i) => (
                <div key={i} className="sparkline-bar" style={{
                    height: `${(v / max) * 100}%`, background: color,
                    opacity: i === data.length - 1 ? 1 : 0.4 + (i / data.length) * 0.4,
                }} />
            ))}
        </div>
    )
}

export default function AdminOverview() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        api.getOverview().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { platformKPIs, revenueHistory, planDistribution, tenants, systemHealth, systemEvents, supportStats } = data
    const opCount = Object.values(systemHealth).filter(s => s.status === 'operational').length
    const totalCount = Object.keys(systemHealth).length

    const statusIcon = status => {
        if (status === 'operational') return <CheckCircle2 size={13} color="var(--green)" />
        if (status === 'degraded') return <AlertTriangle size={13} color="var(--amber)" />
        return <AlertTriangle size={13} color="var(--red)" />
    }

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>لوحة تحكم المشرف</h1>
                    <p>نظرة عامة في الوقت الحقيقي على أداء المنصة والمشتركين والبنية التحتية</p>
                </div>
                <div className="topbar-right">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                        background: 'var(--green-muted)', borderRadius: 'var(--radius-full)',
                        fontSize: 12.5, fontWeight: 600, color: 'var(--green)',
                    }}>
                        <span className="dot" style={{ background: 'var(--green)' }} />
                        {opCount}/{totalCount} أنظمة تعمل
                    </div>
                </div>
            </div>

            {/* KPI Row */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                    { icon: Users, label: 'إجمالي المشتركين', val: platformKPIs.totalTenants.value.toLocaleString('ar-SA'), delta: platformKPIs.totalTenants.delta, spark: platformKPIs.totalTenants.spark, color: 'purple' },
                    { icon: DollarSign, label: 'الإيراد الشهري (MRR)', val: platformKPIs.mrr.value, delta: platformKPIs.mrr.delta, spark: platformKPIs.mrr.spark, color: 'green' },
                    { icon: MessageSquare, label: 'إجمالي الاستعلامات', val: platformKPIs.totalQueries.value, delta: platformKPIs.totalQueries.delta, spark: platformKPIs.totalQueries.spark, color: 'blue' },
                    { icon: Activity, label: 'NPS', val: platformKPIs.nps.value, delta: platformKPIs.nps.delta, color: 'amber' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`}>
                        <div className="stat-top">
                            <div className={`stat-icon ${s.color}`}><s.icon size={17} /></div>
                            {s.spark && <Spark data={s.spark} color={`var(--${s.color === 'purple' ? 'accent' : s.color})`} />}
                        </div>
                        <div className="stat-val">{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                        <div className={`stat-delta ${s.delta > 0 ? 'up' : 'down'}`}>
                            {s.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(s.delta)}٪
                        </div>
                    </div>
                ))}
            </div>

            {/* Secondary KPIs */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 0, marginBottom: 20 }}>
                {[
                    { label: 'الإيراد السنوي (ARR)', val: platformKPIs.arr.value, icon: TrendingUp, color: 'green' },
                    { label: 'متوسط إيراد/مشترك', val: platformKPIs.avgRevenuePerTenant.value, icon: DollarSign, color: 'blue' },
                    { label: 'معدل الاستنزاف', val: platformKPIs.churnRate.value, icon: TrendingDown, color: 'amber' },
                    { label: 'المشتركون النشطون', val: platformKPIs.activeTenants.value.toLocaleString('ar-SA'), icon: Users, color: 'cyan' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`} style={{ cursor: 'default' }}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={17} /></div></div>
                        <div className="stat-val" style={{ fontSize: 22 }}>{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Revenue chart + Plan distribution */}
            <div className="grid-2-1">
                <div className="card anim-in">
                    <div className="card-head">
                        <h3>نمو الإيرادات الشهرية</h3>
                        <span className="badge badge-green"><span className="dot" /> +{platformKPIs.mrr.delta}٪</span>
                    </div>
                    <div className="card-body" style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueHistory}>
                                <defs>
                                    <linearGradient id="gMRR" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#006c35" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#006c35" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gSU" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#006c35" stopOpacity={0.15} />
                                        <stop offset="100%" stopColor="#006c35" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                <XAxis dataKey="month" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                                <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip content={<ChartTip />} />
                                <Area type="monotone" dataKey="mrr" name="MRR ($)" stroke="#006c35" strokeWidth={2} fill="url(#gMRR)" />
                                <Area type="monotone" dataKey="newSignups" name="اشتراكات جديدة" stroke="#006c35" strokeWidth={2} fill="url(#gSU)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card anim-in">
                    <div className="card-head"><h3>توزيع الباقات</h3></div>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 140, height: 140 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={planDistribution} dataKey="count" nameKey="plan" innerRadius={40} outerRadius={65} paddingAngle={3}>
                                        {planDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1 }}>
                            {planDistribution.map((d, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                                    borderBottom: i < planDistribution.length - 1 ? '1px solid var(--border-1)' : 'none',
                                }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{d.plan}</span>
                                    <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)' }}>{d.count.toLocaleString('ar-SA')}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-4)', minWidth: 35 }}>{d.pct}٪</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* System Health + Activity */}
            <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="card anim-in">
                    <div className="card-head">
                        <h3><Server size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />صحة الأنظمة</h3>
                    </div>
                    <div className="card-body">
                        {Object.entries(systemHealth).map(([key, svc], i) => (
                            <div key={key} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                                borderBottom: i < Object.keys(systemHealth).length - 1 ? '1px solid var(--border-1)' : 'none',
                            }}>
                                {statusIcon(svc.status)}
                                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>
                                    {{ api: 'بوابة API', inference: 'محرك الاستدلال', database: 'قاعدة البيانات', storage: 'التخزين', queue: 'قائمة المهام', cdn: 'شبكة CDN' }[key]}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{svc.uptime}٪</span>
                                {svc.latency && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{svc.latency}ms</span>}
                                <span className={`badge ${svc.status === 'operational' ? 'badge-green' : svc.status === 'degraded' ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 9.5 }}>
                                    {svc.status === 'operational' ? 'يعمل' : svc.status === 'degraded' ? 'متأخر' : 'متوقف'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card anim-in">
                    <div className="card-head">
                        <h3><Activity size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />سجل الأحداث</h3>
                    </div>
                    <div className="card-body" style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {systemEvents.map((e, i) => (
                            <div key={i} className="feed-item">
                                <span className="feed-dot" style={{
                                    background: e.type === 'success' ? 'var(--green)' : e.type === 'warning' ? 'var(--amber)' : 'var(--accent)',
                                }} />
                                <div className="feed-body">
                                    <span dangerouslySetInnerHTML={{
                                        __html: e.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    }} style={{ fontSize: 13 }} />
                                    <div className="feed-time">{e.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top tenants */}
            <div className="card anim-in" style={{ marginTop: 20 }}>
                <div className="card-head">
                    <h3><Users size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />أكبر المشتركين</h3>
                    <span className="badge badge-purple">أعلى ٥</span>
                </div>
                <div className="card-body">
                    <div className="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>المشترك</th>
                                    <th>الباقة</th>
                                    <th>MRR</th>
                                    <th>الاستعلامات/شهر</th>
                                    <th>المواقع</th>
                                    <th>آخر نشاط</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...tenants].sort((a, b) => (b.queries_month || 0) - (a.queries_month || 0)).slice(0, 5).map(t => (
                                    <tr key={t.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{t.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>{t.domain}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${t.plan === 'مؤسسي' ? 'badge-amber' : t.plan === 'احترافي' ? 'badge-purple' : 'badge-blue'}`}>
                                                {t.plan}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{t.mrr != null ? `$${t.mrr}` : '—'}</td>
                                        <td style={{ fontFamily: 'var(--mono)' }}>{(t.queries_month || 0).toLocaleString('ar-SA')}</td>
                                        <td>{t.websites ?? '—'}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.lastActive || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Support summary */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 20 }}>
                {[
                    { icon: HeadphonesIcon, label: 'تذاكر مفتوحة', val: (supportStats.open || 0) + (supportStats.inProgress || 0), color: 'amber' },
                    { icon: Clock, label: 'متوسط الاستجابة', val: supportStats.avgResponseTime || '—', color: 'blue' },
                    { icon: CheckCircle2, label: 'متوسط الحل', val: supportStats.avgResolutionTime || '—', color: 'green' },
                    { icon: TrendingUp, label: 'رضا الدعم', val: supportStats.satisfaction != null ? `${supportStats.satisfaction}٪` : '—', color: 'purple' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={17} /></div></div>
                        <div className="stat-val" style={{ fontSize: 22 }}>{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>
        </>
    )
}
