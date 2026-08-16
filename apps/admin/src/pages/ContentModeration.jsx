import { useState, useEffect } from 'react'
import { ShieldAlert, AlertTriangle, Eye, CheckCircle, XCircle, MessageSquare, FileText, Bot, Filter, ChevronDown, ChevronUp, Shield, Zap } from 'lucide-react'
import { api } from '../api'

const severityMap = { critical: { label: 'حرج', badge: 'badge-red', color: '#ef4444' }, high: { label: 'عالي', badge: 'badge-amber', color: '#fbbf24' }, medium: { label: 'متوسط', badge: 'badge-green', color: '#006c35' }, low: { label: 'منخفض', badge: 'badge-green', color: '#0a8244' } }
const statusMap = { pending: { label: 'قيد الانتظار', badge: 'badge-amber' }, reviewed: { label: 'تمت المراجعة', badge: 'badge-blue' }, resolved: { label: 'محلول', badge: 'badge-green' }, dismissed: { label: 'مرفوض', badge: 'badge-purple' } }
const typeIcons = { conversation: MessageSquare, response: Bot, document: FileText }

export default function ContentModeration() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [severityFilter, setSeverityFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [expanded, setExpanded] = useState(null)

    useEffect(() => {
        api.getModeration().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { items: flaggedContent } = data
    const moderationRules = data.rules || []

    const filtered = flaggedContent.filter(f => {
        if (severityFilter !== 'all' && f.severity !== severityFilter) return false
        if (statusFilter !== 'all' && f.status !== statusFilter) return false
        return true
    })

    const pending = flaggedContent.filter(f => f.status === 'pending').length
    const critical = flaggedContent.filter(f => f.severity === 'critical').length
    const autoBlocked = flaggedContent.filter(f => f.autoBlocked).length
    const activeRules = moderationRules.filter(r => r.status === 'active').length

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>🛡️ إدارة المحتوى والإشراف</h1>
                    <p>مراجعة المحتوى المُبلّغ عنه وقواعد الإشراف التلقائي</p>
                </div>
            </div>

            <div className="stats-row">
                {[
                    { label: 'قيد الانتظار', value: pending, icon: AlertTriangle, color: 'amber', st: 'st-amber' },
                    { label: 'حرج', value: critical, icon: ShieldAlert, color: 'red', st: 'st-red' },
                    { label: 'حُظر تلقائياً', value: autoBlocked, icon: Shield, color: 'green', st: 'st-green' },
                    { label: 'قواعد نشطة', value: activeRules, icon: Zap, color: 'blue', st: 'st-blue' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.st}`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={18} /></div></div>
                        <div className="stat-val">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {moderationRules.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-head"><h3>قواعد الإشراف التلقائي ({moderationRules.length})</h3></div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                            {moderationRules.map(r => (
                                <div key={r.id} style={{
                                    padding: 14, background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-1)',
                                    opacity: r.status === 'disabled' ? 0.5 : 1,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                                        <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                                            <span className="dot" /> {r.status === 'active' ? 'مفعّل' : 'معطّل'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)' }}>
                                        <span>{r.category}</span>
                                        <span>إجراء: {r.autoAction}</span>
                                        <span>{r.triggers_24h} تنبيه/٢٤س</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}><Filter size={12} /> فلترة:</span>
                {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                    <button key={s} onClick={() => setSeverityFilter(s)} className={`btn btn-xs ${severityFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                        {s === 'all' ? 'كل الحدة' : severityMap[s].label}
                    </button>
                ))}
                <span style={{ borderRight: '1px solid var(--border-2)', height: 20 }} />
                {['all', 'pending', 'reviewed', 'resolved', 'dismissed'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={`btn btn-xs ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                        {s === 'all' ? 'كل الحالات' : statusMap[s].label}
                    </button>
                ))}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-head"><h3>المحتوى المُبلّغ عنه ({filtered.length})</h3></div>
                <div className="card-body" style={{ padding: 0 }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>لا يوجد محتوى للمراجعة</div>
                    )}
                    {filtered.map(f => {
                        const Icon = typeIcons[f.type] || MessageSquare
                        const isOpen = expanded === f.id
                        const severity = f.severity || 'medium'
                        const reason = f.reason || f.preview?.slice(0, 60) || 'محتوى للمراجعة'
                        const status = f.status || 'pending'
                        return (
                            <div key={f.id} style={{ borderBottom: '1px solid var(--border-1)' }}>
                                <div onClick={() => setExpanded(isOpen ? null : f.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', cursor: 'pointer', transition: 'background 120ms' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: `${severityMap[severity].color}15`, display: 'grid', placeItems: 'center', color: severityMap[severity].color, flexShrink: 0 }}>
                                        <Icon size={16} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>{reason}</span>
                                            <span className={`badge ${severityMap[severity].badge}`}>{severityMap[severity].label}</span>
                                            <span className={`badge ${statusMap[status].badge}`}>{statusMap[status].label}</span>
                                            {f.autoBlocked && <span className="badge badge-red">🚫 محظور تلقائياً</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{f.tenant} · {f.flaggedAt || f.time}{f.pageUrl ? ` · ${f.pageUrl}` : ''}</div>
                                    </div>
                                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-4)' }} />}
                                </div>
                                {isOpen && (
                                    <div style={{ padding: '0 24px 20px 24px' }}>
                                        <div style={{ padding: 14, background: 'var(--bg-0)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-1)', fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.7 }}>
                                            {f.preview || '—'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-xs btn-secondary"><Eye size={11} /> عرض كامل</button>
                                            {status === 'pending' && <>
                                                <button className="btn btn-xs btn-primary"><CheckCircle size={11} /> قبول</button>
                                                <button className="btn btn-xs btn-danger"><XCircle size={11} /> حظر</button>
                                            </>}
                                            <button className="btn btn-xs btn-ghost">تجاهل</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </>
    )
}
