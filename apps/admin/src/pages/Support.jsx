import { useState, useEffect, useMemo } from 'react'
import {
    HeadphonesIcon, Search, Clock, CheckCircle2, AlertCircle,
    AlertTriangle, User, CalendarDays, Tag, MessageSquare,
    TrendingUp, Loader, Pause, Filter,
} from 'lucide-react'
import { api } from '../api'

const priorityInfo = {
    critical: { cls: 'badge-red', label: 'حرج', color: 'var(--red)' },
    high: { cls: 'badge-amber', label: 'عالي', color: 'var(--amber)' },
    medium: { cls: 'badge-blue', label: 'متوسط', color: 'var(--blue)' },
    low: { cls: 'badge-green', label: 'منخفض', color: 'var(--green)' },
}

const statusInfo = {
    open: { cls: 'badge-red', label: 'مفتوح', icon: AlertCircle },
    in_progress: { cls: 'badge-amber', label: 'قيد المعالجة', icon: Loader },
    waiting: { cls: 'badge-blue', label: 'بانتظار الرد', icon: Pause },
    resolved: { cls: 'badge-green', label: 'محلول', icon: CheckCircle2 },
}

export default function Support() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selected, setSelected] = useState(null)

    useEffect(() => {
        api.getSupport().then(setData).catch(e => setError(e.message))
    }, [])

    const supportTickets = data?.tickets ?? []
    const supportStats = data?.stats ?? {}

    const filtered = useMemo(() => supportTickets.filter(t => {
        const sm = t.subject.includes(search) || t.tenant.includes(search) || t.id.includes(search)
        const pf = priorityFilter === 'all' || t.priority === priorityFilter
        const sf = statusFilter === 'all' || t.status === statusFilter
        return sm && pf && sf
    }), [supportTickets, search, priorityFilter, statusFilter])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>تذاكر الدعم</h1>
                    <p>إدارة ومتابعة طلبات الدعم الفني من المشتركين</p>
                </div>
                <div className="topbar-right">
                    <button className="btn btn-primary btn-sm"><HeadphonesIcon size={14} /> تذكرة جديدة</button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
                {[
                    { icon: AlertCircle, label: 'مفتوحة', val: supportStats.open ?? 0, color: 'amber' },
                    { icon: Loader, label: 'قيد المعالجة', val: supportStats.inProgress ?? 0, color: 'blue' },
                    { icon: Clock, label: 'متوسط الاستجابة', val: supportStats.avgResponseTime || '—', color: 'purple' },
                    { icon: TrendingUp, label: 'رضا الدعم', val: supportStats.satisfaction != null ? `${supportStats.satisfaction}٪` : '—', color: 'green' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={17} /></div></div>
                        <div className="stat-val">{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card anim-in" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
                            <Search size={14} style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-4)' }} />
                            <input className="input" placeholder="بحث بالموضوع أو المشترك أو رقم التذكرة..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingRight: 30, fontSize: 12.5 }} />
                        </div>

                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-4)', fontWeight: 600, marginInlineEnd: 4 }}>الأولوية:</span>
                            {['all', 'critical', 'high', 'medium', 'low'].map(p => (
                                <button key={p} onClick={() => setPriorityFilter(p)} style={{
                                    padding: '4px 10px', fontSize: 10.5, fontWeight: 600, borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                    background: priorityFilter === p ? 'var(--accent-muted)' : 'var(--bg-3)',
                                    color: priorityFilter === p ? 'var(--accent)' : 'var(--text-3)',
                                    border: `1px solid ${priorityFilter === p ? 'var(--accent-border)' : 'var(--border-1)'}`,
                                    transition: 'all 150ms',
                                }}>{p === 'all' ? 'الكل' : priorityInfo[p].label}</button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-4)', fontWeight: 600, marginInlineEnd: 4 }}>الحالة:</span>
                            {['all', 'open', 'in_progress', 'waiting', 'resolved'].map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)} style={{
                                    padding: '4px 10px', fontSize: 10.5, fontWeight: 600, borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                    background: statusFilter === s ? 'var(--accent-muted)' : 'var(--bg-3)',
                                    color: statusFilter === s ? 'var(--accent)' : 'var(--text-3)',
                                    border: `1px solid ${statusFilter === s ? 'var(--accent-border)' : 'var(--border-1)'}`,
                                    transition: 'all 150ms',
                                }}>{s === 'all' ? 'الكل' : statusInfo[s]?.label}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tickets table */}
            <div className="card anim-in">
                <div className="card-body">
                    <div className="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>رقم</th>
                                    <th>الموضوع</th>
                                    <th>المشترك</th>
                                    <th>التصنيف</th>
                                    <th>الأولوية</th>
                                    <th>الحالة</th>
                                    <th>المسؤول</th>
                                    <th>الوقت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(t => {
                                    const pri = priorityInfo[t.priority]
                                    const sta = statusInfo[t.status]
                                    return (
                                        <tr key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)} style={{
                                            cursor: 'pointer',
                                            background: selected?.id === t.id ? 'var(--accent-muted)' : undefined,
                                        }}>
                                            <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{t.id}</td>
                                            <td style={{ fontWeight: 600, maxWidth: 280 }}>{t.subject}</td>
                                            <td style={{ fontSize: 13 }}>{t.tenant}</td>
                                            <td><span style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-4)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{t.category}</span></td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                                    fontSize: 11, fontWeight: 700,
                                                    background: `${pri.color}15`, color: pri.color,
                                                }}>
                                                    {t.priority === 'critical' && <AlertTriangle size={10} />}
                                                    {pri.label}
                                                </span>
                                            </td>
                                            <td><span className={`badge ${sta.cls}`}><span className="dot" /> {sta.label}</span></td>
                                            <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                                {t.assignee || <span style={{ color: 'var(--red)', fontWeight: 600 }}>— غير مُعيَّن</span>}
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--text-4)' }}>{t.created}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-1)', fontSize: 12, color: 'var(--text-4)', textAlign: 'center' }}>
                    عرض {filtered.length} من {supportTickets.length} تذاكر
                </div>
            </div>

            {/* Selected detail */}
            {selected && (
                <div className="card anim-in" style={{ marginTop: 16, border: '1px solid var(--accent-border)' }}>
                    <div className="card-head">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{selected.id}</span>
                            {selected.subject}
                        </h3>
                        <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>إغلاق</button>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
                            {[
                                { label: 'المشترك', val: selected.tenant },
                                { label: 'التصنيف', val: selected.category },
                                { label: 'الأولوية', val: priorityInfo[selected.priority].label },
                                { label: 'الحالة', val: statusInfo[selected.status].label },
                                { label: 'المسؤول', val: selected.assignee || 'غير مُعيَّن' },
                                { label: 'تاريخ الإنشاء', val: selected.created },
                            ].map((item, i) => (
                                <div key={i}>
                                    <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{item.val}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary btn-sm">الرد على التذكرة</button>
                            {!selected.assignee && <button className="btn btn-secondary btn-sm">تعيين مسؤول</button>}
                            {selected.status !== 'resolved' && <button className="btn btn-secondary btn-sm"><CheckCircle2 size={13} /> تعليم كمحلول</button>}
                            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}>تصعيد</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category breakdown */}
            <div className="card anim-in" style={{ marginTop: 20 }}>
                <div className="card-head"><h3>التذاكر حسب التصنيف</h3></div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        {['تقني', 'فوترة', 'ميزة', 'أداء', 'مبيعات'].map(cat => {
                            const count = supportTickets.filter(t => t.category === cat).length
                            const openCount = supportTickets.filter(t => t.category === cat && t.status !== 'resolved').length
                            return (
                                <div key={cat} style={{
                                    padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-3)', border: '1px solid var(--border-1)', textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginBottom: 2 }}>{count}</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>{cat}</div>
                                    {openCount > 0 && <div style={{ fontSize: 11, color: 'var(--amber)' }}>{openCount} مفتوح</div>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}
