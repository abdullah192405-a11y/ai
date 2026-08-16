import { useState, useEffect } from 'react'
import { ScrollText, Search, Shield, Settings, HeadphonesIcon, DollarSign, Server, User, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../api'

const categoryMap = {
    'نظام': { icon: Server, color: '#006c35', bg: 'rgba(0,108,53,0.10)' },
    'أمان': { icon: Shield, color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
    'دعم': { icon: HeadphonesIcon, color: '#0a8244', bg: 'rgba(10,130,68,0.10)' },
    'فوترة': { icon: DollarSign, color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
    'إعدادات': { icon: Settings, color: '#1a9a52', bg: 'rgba(26,154,82,0.10)' },
}

function inferCategory(log) {
    if (log.category) return log.category
    if (log.action?.includes('auth') || log.action?.includes('password')) return 'أمان'
    if (log.resource === 'tenant' || log.action?.includes('tenant')) return 'نظام'
    return 'نظام'
}

export default function AuditLog() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('all')

    useEffect(() => {
        api.getAuditLog().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { entries: auditLogs } = data

    const categories = [...new Set(auditLogs.map(l => inferCategory(l)))]

    const filtered = auditLogs.filter(l => {
        const category = inferCategory(l)
        if (catFilter !== 'all' && category !== catFilter) return false
        const target = l.target || l.resource || ''
        if (search && !l.action?.includes(search) && !l.actor?.includes(search) && !target.includes(search)) return false
        return true
    })

    const securityCount = auditLogs.filter(l => inferCategory(l) === 'أمان').length
    const systemCount = auditLogs.filter(l => inferCategory(l) === 'نظام').length
    const autoCount = auditLogs.filter(l => l.actorRole === 'آلي' || l.actor?.includes('admin') === false && l.actor?.includes('platform')).length

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>📋 سجل التدقيق</h1>
                    <p>تتبع جميع الأنشطة والإجراءات على المنصة — {auditLogs.length} حدث</p>
                </div>
                <div className="topbar-right">
                    <button className="btn btn-secondary"><Download size={15} /> تصدير CSV</button>
                </div>
            </div>

            <div className="stats-row">
                {[
                    { label: 'إجمالي الأحداث', value: auditLogs.length, icon: ScrollText, color: 'red', st: 'st-red' },
                    { label: 'أحداث أمنية', value: securityCount, icon: Shield, color: 'amber', st: 'st-amber' },
                    { label: 'أحداث النظام', value: systemCount, icon: Server, color: 'blue', st: 'st-blue' },
                    { label: 'أحداث آلية', value: autoCount, icon: Settings, color: 'green', st: 'st-green' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.st}`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={18} /></div></div>
                        <div className="stat-val">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                    <input className="input" placeholder="بحث في الإجراءات، الفاعل، الهدف..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingRight: 36 }} />
                </div>
                {categories.map(c => (
                    <button key={c} onClick={() => setCatFilter(catFilter === c ? 'all' : c)}
                        className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-secondary'}`}>
                        {c}
                    </button>
                ))}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-head"><h3>السجل الزمني</h3></div>
                <div className="card-body" style={{ padding: 0 }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>لا توجد أحداث</div>
                    )}
                    {filtered.map((log, i) => {
                        const category = inferCategory(log)
                        const cat = categoryMap[category] || { icon: ScrollText, color: '#757ba3', bg: 'rgba(117,123,163,0.1)' }
                        const Icon = cat.icon
                        const target = log.target || log.resource || '—'
                        return (
                            <div key={log.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 24px',
                                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-1)' : 'none',
                                transition: 'background 120ms',
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: cat.bg, display: 'grid', placeItems: 'center', color: cat.color, flexShrink: 0 }}>
                                        <Icon size={14} />
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{log.action}</span>
                                        <span className={`badge ${category === 'أمان' ? 'badge-red' : category === 'نظام' ? 'badge-blue' : category === 'دعم' ? 'badge-green' : 'badge-amber'}`}>
                                            {category}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                                        الهدف: <strong style={{ color: 'var(--text-2)' }}>{target}</strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-4)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <User size={10} /> {log.actor} {log.actorRole ? `(${log.actorRole})` : ''}
                                        </span>
                                        {log.ip && <span>IP: <span style={{ direction: 'ltr', display: 'inline-block' }}>{log.ip}</span></span>}
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', fontFamily: 'var(--mono)', direction: 'ltr', whiteSpace: 'nowrap' }}>
                                    {log.time}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="card-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>عرض {filtered.length} من {auditLogs.length} حدث</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-xs btn-secondary"><ChevronRight size={12} /> السابق</button>
                        <button className="btn btn-xs btn-secondary">التالي <ChevronLeft size={12} /></button>
                    </div>
                </div>
            </div>
        </>
    )
}
