import { useState, useEffect } from 'react'
import { Globe, Search, Play, Pause, RotateCw, CheckCircle, XCircle, Clock, Loader, FileText, AlertTriangle, Database } from 'lucide-react'
import { api } from '../api'

const statusMap = {
    completed: { label: 'مكتمل', badge: 'badge-green', icon: CheckCircle, color: '#006c35' },
    running: { label: 'قيد التشغيل', badge: 'badge-green', icon: Loader, color: '#0a8244' },
    queued: { label: 'في الانتظار', badge: 'badge-amber', icon: Clock, color: '#fbbf24' },
    failed: { label: 'فشل', badge: 'badge-red', icon: XCircle, color: '#f87171' },
    active: { label: 'نشط', badge: 'badge-green', icon: CheckCircle, color: '#006c35' },
    pending: { label: 'في الانتظار', badge: 'badge-amber', icon: Clock, color: '#fbbf24' },
}

function deriveCrawlStats(jobs) {
    const totalPages = jobs.reduce((s, j) => s + (j.pages || 0), 0)
    return {
        totalPages,
        indexedToday: '—',
        failedToday: jobs.filter(j => j.status === 'failed').length,
        avgDuration: '—',
        activeJobs: jobs.filter(j => j.status === 'running').length,
        queuedJobs: jobs.filter(j => j.status === 'queued' || j.status === 'pending').length,
    }
}

export default function CrawlJobs() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [search, setSearch] = useState('')

    useEffect(() => {
        api.getCrawlJobs().then(setData).catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { jobs: crawlJobs } = data
    const crawlStats = deriveCrawlStats(crawlJobs)

    const filtered = crawlJobs.filter(j => {
        if (statusFilter !== 'all' && j.status !== statusFilter) return false
        if (search && !j.tenant?.includes(search) && !j.domain?.includes(search)) return false
        return true
    })

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>🕷️ عمليات الزحف والفهرسة</h1>
                    <p>مراقبة عمليات زحف المواقع وفهرسة المحتوى عبر جميع المشتركين</p>
                </div>
                <div className="topbar-right">
                    <button className="btn btn-primary"><Play size={15} /> تشغيل زحف يدوي</button>
                </div>
            </div>

            <div className="stats-row">
                {[
                    { label: 'إجمالي الصفحات', value: crawlStats.totalPages.toLocaleString(), icon: FileText, color: 'red', st: 'st-red' },
                    { label: 'مفهرس اليوم', value: crawlStats.indexedToday, icon: Database, color: 'green', st: 'st-green' },
                    { label: 'فشل اليوم', value: crawlStats.failedToday, icon: AlertTriangle, color: 'amber', st: 'st-amber' },
                    { label: 'متوسط المدة', value: crawlStats.avgDuration, icon: Clock, color: 'blue', st: 'st-blue' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.st}`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={18} /></div></div>
                        <div className="stat-val">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ padding: '12px 20px', background: 'rgba(0,108,53,0.08)', border: '1px solid rgba(0,108,53,0.15)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <Loader size={14} style={{ color: '#006c35', animation: 'spin 2s linear infinite' }} />
                    <span style={{ fontWeight: 600, color: '#006c35' }}>{crawlStats.activeJobs} عملية نشطة</span>
                </div>
                <div style={{ padding: '12px 20px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <Clock size={14} style={{ color: '#fbbf24' }} />
                    <span style={{ fontWeight: 600, color: '#fbbf24' }}>{crawlStats.queuedJobs} في قائمة الانتظار</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                    <input className="input" placeholder="بحث بالمشترك أو النطاق..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingRight: 36 }} />
                </div>
                {['all', 'running', 'queued', 'completed', 'failed', 'active', 'pending'].filter(s => s === 'all' || statusMap[s]).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                        {s === 'all' ? 'الكل' : statusMap[s].label}
                    </button>
                ))}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body" style={{ padding: 0 }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>لا توجد عمليات زحف</div>
                    )}
                    {filtered.map(j => {
                        const st = statusMap[j.status] || statusMap.pending
                        const Icon = st.icon
                        const pct = j.status === 'completed' ? 100 : j.status === 'running' ? (j.progress || 0) : 0
                        return (
                            <div key={j.id} style={{ borderBottom: '1px solid var(--border-1)', padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: `${st.color}15`, display: 'grid', placeItems: 'center', color: st.color, flexShrink: 0 }}>
                                        <Icon size={18} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <span style={{ fontWeight: 700, fontSize: 14 }}>{j.tenant}</span>
                                            <span className={`badge ${st.badge}`}><span className="dot" /> {st.label}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-4)' }}>
                                            <span style={{ direction: 'ltr', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Globe size={10} /> {j.domain}</span>
                                            {j.frequency && <span>التكرار: {j.frequency}</span>}
                                            {j.lastCrawled && <span>آخر زحف: {j.lastCrawled}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {j.status === 'running' && <button className="btn btn-xs btn-secondary"><Pause size={11} /> إيقاف</button>}
                                        {(j.status === 'completed' || j.status === 'failed') && <button className="btn btn-xs btn-secondary"><RotateCw size={11} /> إعادة</button>}
                                        {(j.status === 'queued' || j.status === 'pending') && <button className="btn btn-xs btn-primary"><Play size={11} /> تشغيل الآن</button>}
                                    </div>
                                </div>

                                {j.status === 'running' && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div className="progress" style={{ height: 8 }}>
                                            <div className="progress-fill blue" style={{ width: `${pct}%` }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                                            <span>{j.indexed ?? 0} / {j.pages ?? 0} صفحة مفهرسة</span>
                                            <span>{pct}%</span>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                                    <div><span style={{ color: 'var(--text-4)' }}>الصفحات:</span> <strong>{(j.pages || 0).toLocaleString()}</strong></div>
                                    {j.indexed != null && <div><span style={{ color: 'var(--text-4)' }}>مفهرس:</span> <strong style={{ color: 'var(--green)' }}>{j.indexed.toLocaleString()}</strong></div>}
                                    {j.failed > 0 && <div><span style={{ color: 'var(--text-4)' }}>فشل:</span> <strong style={{ color: 'var(--red)' }}>{j.failed}</strong></div>}
                                    {j.autoCrawl != null && <div><span style={{ color: 'var(--text-4)' }}>زحف تلقائي:</span> <strong>{j.autoCrawl ? 'نعم' : 'لا'}</strong></div>}
                                </div>

                                {j.error && (
                                    <div style={{ marginTop: 10, padding: 10, background: 'var(--red-muted)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--red)' }}>
                                        <AlertTriangle size={13} /> {j.error}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </>
    )
}
