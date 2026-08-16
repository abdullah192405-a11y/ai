import { useState, useEffect } from 'react'
import {
    Server, CheckCircle2, AlertTriangle, XCircle, Clock, Zap,
    Database, HardDrive, Wifi, Globe, Activity, RefreshCw,
    TrendingUp, Shield,
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { api } from '../api'
import ChartTip from '@wba/dashboard-ui/ChartTip'

const serviceIcons = {
    api: Globe, inference: Zap, database: Database,
    storage: HardDrive, queue: RefreshCw, cdn: Wifi,
}
const serviceNames = {
    api: 'بوابة API', inference: 'محرك الاستدلال', database: 'قاعدة البيانات',
    storage: 'التخزين', queue: 'قائمة المهام', cdn: 'شبكة CDN',
}

function StatusIcon({ status }) {
    if (status === 'operational') return <CheckCircle2 size={18} color="var(--green)" />
    if (status === 'degraded') return <AlertTriangle size={18} color="var(--amber)" />
    return <XCircle size={18} color="var(--red)" />
}

export default function SystemHealth() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        api.getSystem().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { systemHealth, systemEvents, activityHistory = [], errorRates = [] } = data
    const opCount = Object.values(systemHealth).filter(s => s.status === 'operational').length
    const totalCount = Object.keys(systemHealth).length
    const hasCharts = activityHistory.length > 0

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>صحة النظام</h1>
                    <p>مراقبة البنية التحتية والأداء والأخطاء في الوقت الحقيقي</p>
                </div>
                <div className="topbar-right">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                        background: opCount === totalCount ? 'var(--green-muted)' : 'var(--amber-muted)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 12.5, fontWeight: 600,
                        color: opCount === totalCount ? 'var(--green)' : 'var(--amber)',
                    }}>
                        <span className="dot" style={{ background: opCount === totalCount ? 'var(--green)' : 'var(--amber)' }} />
                        {opCount}/{totalCount} أنظمة تعمل
                    </div>
                </div>
            </div>

            {/* Service Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                {Object.entries(systemHealth).map(([key, svc]) => {
                    const Icon = serviceIcons[key] || Server
                    return (
                        <div key={key} className="card anim-in" style={{
                            borderTop: `3px solid ${svc.status === 'operational' ? 'var(--green)' : svc.status === 'degraded' ? 'var(--amber)' : 'var(--red)'}`,
                        }}>
                            <div className="card-body" style={{ padding: '16px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <StatusIcon status={svc.status} />
                                    <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{serviceNames[key]}</span>
                                    <span className={`badge ${svc.status === 'operational' ? 'badge-green' : svc.status === 'degraded' ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                        {svc.status === 'operational' ? 'يعمل' : svc.status === 'degraded' ? 'متأخر' : 'متوقف'}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>التوفر</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{svc.uptime}٪</div>
                                    </div>
                                    {svc.latency !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>التأخير</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{svc.latency}ms</div>
                                        </div>
                                    )}
                                    {svc.rps !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>طلب/ثانية</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{svc.rps.toLocaleString('ar-SA')}</div>
                                        </div>
                                    )}
                                    {svc.errors_24h !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>أخطاء/٢٤ س</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: svc.errors_24h > 5 ? 'var(--amber)' : 'var(--green)' }}>{svc.errors_24h}</div>
                                        </div>
                                    )}
                                    {svc.connections !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>اتصالات</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{svc.connections}</div>
                                        </div>
                                    )}
                                    {svc.pct !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>استخدام</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: svc.pct > 80 ? 'var(--red)' : 'var(--text-1)' }}>{svc.pct}٪</div>
                                        </div>
                                    )}
                                    {svc.pending !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>في الانتظار</div>
                                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{svc.pending}</div>
                                        </div>
                                    )}
                                    {svc.regions !== undefined && (
                                        <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>المناطق</div>
                                            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{svc.regions}</div>
                                        </div>
                                    )}
                                </div>
                                {svc.note && (
                                    <div style={{
                                        marginTop: 8, padding: '6px 10px', borderRadius: 'var(--radius-xs)',
                                        background: 'var(--amber-muted)', fontSize: 11, color: 'var(--amber)',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                    }}>
                                        <AlertTriangle size={12} /> {svc.note}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Charts */}
            <div className="grid-2">
                <div className="card anim-in">
                    <div className="card-head"><h3>نشاط المنصة اليوم</h3></div>
                    <div className="card-body" style={{ height: 260 }}>
                        {hasCharts ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activityHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                    <XAxis dataKey="time" stroke="var(--text-4)" fontSize={11} tickLine={false} />
                                    <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" />
                                    <Tooltip content={<ChartTip />} />
                                    <Area type="monotone" dataKey="api" name="API" stroke="#0a8244" strokeWidth={2} fill="none" />
                                    <Area type="monotone" dataKey="inference" name="الاستدلال" stroke="#006c35" strokeWidth={2} fill="none" />
                                    <Area type="monotone" dataKey="database" name="قاعدة البيانات" stroke="#1a9a52" strokeWidth={2} fill="none" />
                                    <Area type="monotone" dataKey="cdn" name="CDN" stroke="#fbbf24" strokeWidth={2} fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-4)', fontSize: 13 }}>
                                لا توجد رسائل مسجّلة اليوم بعد
                            </div>
                        )}
                    </div>
                    <div className="card-foot" style={{ display: 'flex', gap: 16 }}>
                        {[
                            { l: 'API', c: '#0a8244' }, { l: 'الاستدلال', c: '#006c35' },
                            { l: 'قاعدة البيانات', c: '#1a9a52' }, { l: 'CDN', c: '#fbbf24' },
                        ].map(x => (
                            <span key={x.l} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: x.c, marginInlineEnd: 5, verticalAlign: -1 }} />{x.l}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="card anim-in">
                    <div className="card-head"><h3>معدل الأخطاء</h3></div>
                    <div className="card-body" style={{ height: 260 }}>
                        {errorRates.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={errorRates}>
                                <defs>
                                    <linearGradient id="g4xx" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="g5xx" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f87171" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                <XAxis dataKey="time" stroke="var(--text-4)" fontSize={11} tickLine={false} />
                                <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" unit="%" />
                                <Tooltip content={<ChartTip />} />
                                <Area type="monotone" dataKey="rate_4xx" name="أخطاء 4xx" stroke="#fbbf24" strokeWidth={2} fill="url(#g4xx)" />
                                <Area type="monotone" dataKey="rate_5xx" name="أخطاء 5xx" stroke="#f87171" strokeWidth={2} fill="url(#g5xx)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-4)', fontSize: 13 }}>
                                لا توجد أخطاء مسجّلة اليوم
                            </div>
                        )}
                    </div>
                    <div className="card-foot" style={{ display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#fbbf24', marginInlineEnd: 5, verticalAlign: -1 }} />أخطاء 4xx
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f87171', marginInlineEnd: 5, verticalAlign: -1 }} />أخطاء 5xx
                        </span>
                    </div>
                </div>
            </div>

            {/* Event log */}
            <div className="card anim-in" style={{ marginTop: 20 }}>
                <div className="card-head">
                    <h3><Activity size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />سجل أحداث النظام</h3>
                    <span className="badge badge-blue">{systemEvents.length} أحداث اليوم</span>
                </div>
                <div className="card-body">
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
        </>
    )
}
