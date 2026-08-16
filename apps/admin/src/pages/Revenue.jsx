import { useState, useEffect } from 'react'
import {
    DollarSign, TrendingUp, TrendingDown, Users, CreditCard,
    ArrowDown, ArrowUp, Repeat, AlertTriangle,
} from 'lucide-react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { api } from '../api'
import ChartTip from '@wba/dashboard-ui/ChartTip'

function buildCohortData(revenueHistory) {
    return revenueHistory.map((row, i) => {
        const prev = revenueHistory[i - 1]
        const newMRR = row.newSignups * 29
        const churnMRR = prev ? -Math.round(prev.mrr * 0.02) : 0
        return {
            month: row.month,
            newMRR,
            expansionMRR: Math.round(newMRR * 0.3),
            churnMRR,
            netNew: newMRR + Math.round(newMRR * 0.3) + churnMRR,
        }
    })
}

export default function Revenue() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        api.getRevenue().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { platformKPIs, revenueHistory, planDistribution } = data
    const cohortData = buildCohortData(revenueHistory)
    const revenueByPlan = planDistribution.map(p => ({
        plan: p.plan,
        revenue: p.revenue,
        color: p.color,
    }))
    const latestHistory = revenueHistory[revenueHistory.length - 1]
    const prevHistory = revenueHistory[revenueHistory.length - 2]
    const mrrGrowth = latestHistory && prevHistory?.mrr
        ? ((latestHistory.mrr - prevHistory.mrr) / prevHistory.mrr * 100).toFixed(1)
        : '0'

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>الإيرادات والمالية</h1>
                    <p>تحليل شامل للإيرادات والنمو والاستنزاف عبر جميع الباقات</p>
                </div>
            </div>

            {/* Financial KPIs */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
                {[
                    { icon: DollarSign, label: 'MRR الحالي', val: platformKPIs.mrr.value, delta: platformKPIs.mrr.delta, color: 'green' },
                    { icon: TrendingUp, label: 'ARR', val: platformKPIs.arr.value, delta: platformKPIs.arr.delta, color: 'purple' },
                    { icon: CreditCard, label: 'ARPU', val: platformKPIs.avgRevenuePerTenant.value, delta: platformKPIs.avgRevenuePerTenant.delta, color: 'blue' },
                    { icon: TrendingDown, label: 'معدل الاستنزاف', val: platformKPIs.churnRate.value, delta: platformKPIs.churnRate.delta, color: 'amber' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={17} /></div></div>
                        <div className="stat-val">{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                        {s.delta !== undefined && (
                            <div className={`stat-delta ${s.delta > 0 ? 'up' : 'down'}`}>
                                {s.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                {Math.abs(s.delta)}٪
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* MRR trend + MRR movement */}
            <div className="grid-2">
                <div className="card anim-in">
                    <div className="card-head">
                        <h3>اتجاه MRR</h3>
                        <span className="badge badge-green"><span className="dot" /> +{mrrGrowth}٪ شهري</span>
                    </div>
                    <div className="card-body" style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueHistory}>
                                <defs>
                                    <linearGradient id="gMRR2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#006c35" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#006c35" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                <XAxis dataKey="month" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                                <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip content={<ChartTip />} />
                                <Area type="monotone" dataKey="mrr" name="MRR ($)" stroke="#006c35" strokeWidth={2.5} fill="url(#gMRR2)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card anim-in">
                    <div className="card-head"><h3>حركة MRR الشهرية</h3></div>
                    <div className="card-body" style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cohortData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                <XAxis dataKey="month" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                                <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip content={<ChartTip />} />
                                <Bar dataKey="newMRR" name="جديد" fill="#006c35" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="expansionMRR" name="توسع" fill="#006c35" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="churnMRR" name="استنزاف" fill="#f87171" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="card-foot" style={{ display: 'flex', gap: 16 }}>
                        {[
                            { label: 'جديد', color: '#006c35' },
                            { label: 'توسع', color: '#006c35' },
                            { label: 'استنزاف', color: '#f87171' },
                        ].map(l => (
                            <span key={l.label} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: l.color, marginInlineEnd: 5, verticalAlign: -1 }} />
                                {l.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Revenue by Plan + Customer growth */}
            <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="card anim-in">
                    <div className="card-head"><h3>الإيراد حسب الباقة</h3></div>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 150, height: 150 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={revenueByPlan} dataKey="revenue" nameKey="plan" innerRadius={42} outerRadius={68} paddingAngle={3}>
                                        {revenueByPlan.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1 }}>
                            {planDistribution.map((p, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
                                    borderBottom: i < planDistribution.length - 1 ? '1px solid var(--border-1)' : 'none',
                                }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{p.plan}</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--mono)' }}>${p.revenue.toLocaleString('ar-SA')}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{p.count} مشترك</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card anim-in">
                    <div className="card-head"><h3>نمو المشتركين</h3></div>
                    <div className="card-body" style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueHistory}>
                                <defs>
                                    <linearGradient id="gTenants" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#006c35" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#006c35" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                <XAxis dataKey="month" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                                <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" />
                                <Tooltip content={<ChartTip />} />
                                <Area type="monotone" dataKey="tenants" name="إجمالي المشتركين" stroke="#006c35" strokeWidth={2.5} fill="url(#gTenants)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Financial Health Metrics */}
            <div className="card anim-in" style={{ marginTop: 20 }}>
                <div className="card-head"><h3>المؤشرات المالية الرئيسية</h3></div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                        {[
                            { label: 'LTV المتوقع', val: '$1,960', desc: 'متوسط عمر المشترك × ARPU', icon: DollarSign, color: 'var(--green)' },
                            { label: 'LTV/CAC', val: '4.8x', desc: 'نسبة صحية (مستهدف: > 3x)', icon: TrendingUp, color: 'var(--accent)' },
                            { label: 'معدل التحويل', val: '38٪', desc: 'من تجريبي إلى مدفوع', icon: Repeat, color: 'var(--blue)' },
                            { label: 'وقت الاسترداد', val: '٦.٢ شهر', desc: 'CAC payback period', icon: ArrowDown, color: 'var(--amber)' },
                            { label: 'Net Revenue Retention', val: '١١٢٪', desc: 'توسع أكثر من الاستنزاف', icon: ArrowUp, color: 'var(--green)' },
                            { label: 'Gross Margin', val: '٧٨٪', desc: 'بعد تكاليف البنية التحتية و AI', icon: DollarSign, color: 'var(--cyan)' },
                        ].map((m, i) => (
                            <div key={i} style={{
                                padding: 16, borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-3)', border: '1px solid var(--border-1)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}15`, display: 'grid', placeItems: 'center' }}>
                                        <m.icon size={16} color={m.color} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{m.label}</span>
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4, fontFamily: 'var(--mono)' }}>{m.val}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{m.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
