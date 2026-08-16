import { useState, useEffect } from 'react'
import { Megaphone, Plus, Send, Clock, Eye, Pencil, Trash2, Users, Shield, Star, DollarSign, Wrench, Filter } from 'lucide-react'
import { api } from '../api'

const typeMap = {
    feature: { label: 'ميزة جديدة', icon: Star, color: '#006c35', bg: 'rgba(0,108,53,0.10)' },
    maintenance: { label: 'صيانة', icon: Wrench, color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
    billing: { label: 'فوترة', icon: DollarSign, color: '#0a8244', bg: 'rgba(10,130,68,0.10)' },
    security: { label: 'أمان', icon: Shield, color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
}

const statusMap = {
    published: { label: 'منشور', badge: 'badge-green' },
    scheduled: { label: 'مجدول', badge: 'badge-amber' },
    draft: { label: 'مسودة', badge: 'badge-purple' },
}

export default function Announcements() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [expanded, setExpanded] = useState(null)

    useEffect(() => {
        api.getAnnouncements().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { announcements } = data

    const filtered = announcements.filter(a => {
        if (typeFilter !== 'all' && a.type !== typeFilter) return false
        if (statusFilter !== 'all' && a.status !== statusFilter) return false
        return true
    })

    const published = announcements.filter(a => a.status === 'published').length
    const scheduled = announcements.filter(a => a.status === 'scheduled').length
    const drafts = announcements.filter(a => a.status === 'draft').length

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>📢 الإعلانات</h1>
                    <p>إدارة الإعلانات والإشعارات على مستوى المنصة</p>
                </div>
                <div className="topbar-right">
                    <button className="btn btn-primary"><Plus size={15} /> إنشاء إعلان</button>
                </div>
            </div>

            {/* KPIs */}
            <div className="stats-row">
                {[
                    { label: 'إجمالي الإعلانات', value: announcements.length, icon: Megaphone, color: 'red', st: 'st-red' },
                    { label: 'منشور', value: published, icon: Send, color: 'green', st: 'st-green' },
                    { label: 'مجدول', value: scheduled, icon: Clock, color: 'amber', st: 'st-amber' },
                    { label: 'مسودات', value: drafts, icon: Pencil, color: 'purple', st: 'st-purple' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.st}`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={18} /></div></div>
                        <div className="stat-val">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}><Filter size={12} /> النوع:</span>
                {['all', ...Object.keys(typeMap)].map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)} className={`btn btn-xs ${typeFilter === t ? 'btn-primary' : 'btn-secondary'}`}>
                        {t === 'all' ? 'الكل' : typeMap[t].label}
                    </button>
                ))}
                <span style={{ borderRight: '1px solid var(--border-2)', height: 20 }} />
                {['all', 'published', 'scheduled', 'draft'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={`btn btn-xs ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                        {s === 'all' ? 'كل الحالات' : statusMap[s].label}
                    </button>
                ))}
            </div>

            {/* Announcements List */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body" style={{ padding: 0 }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>لا توجد إعلانات</div>
                    )}
                    {filtered.map(a => {
                        const t = typeMap[a.type]
                        const Icon = t.icon
                        const isOpen = expanded === a.id
                        return (
                            <div key={a.id} style={{ borderBottom: '1px solid var(--border-1)' }}>
                                <div onClick={() => setExpanded(isOpen ? null : a.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', cursor: 'pointer', transition: 'background 120ms' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: t.bg, display: 'grid', placeItems: 'center', color: t.color, flexShrink: 0 }}>
                                        <Icon size={18} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</span>
                                            <span className={`badge ${statusMap[a.status].badge}`}>{statusMap[a.status].label}</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: t.bg, color: t.color }}>{t.label}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-4)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={10} /> {a.audience === 'all' ? 'جميع المشتركين' : a.audience}</span>
                                            <span>أنشأه {a.author}</span>
                                            <span>{a.createdAt}</span>
                                            {a.publishAt && <span>نشر: {a.publishAt}</span>}
                                        </div>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div style={{ padding: '0 24px 20px 24px' }}>
                                        <div style={{ padding: 16, background: 'var(--bg-0)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-1)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 14 }}>
                                            {a.body}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-xs btn-secondary"><Pencil size={11} /> تعديل</button>
                                            {a.status === 'draft' && <button className="btn btn-xs btn-primary"><Send size={11} /> نشر الآن</button>}
                                            {a.status === 'scheduled' && <button className="btn btn-xs btn-secondary"><Eye size={11} /> معاينة</button>}
                                            <button className="btn btn-xs btn-danger"><Trash2 size={11} /> حذف</button>
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
