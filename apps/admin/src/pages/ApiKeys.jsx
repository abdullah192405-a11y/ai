import { useState, useEffect, useCallback } from 'react'
import { Key, Copy, Trash2, RefreshCw, ShieldCheck, Clock, Zap, Check } from 'lucide-react'
import { api } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const scopeLabels = { full: 'كامل', webhooks: 'Webhooks', analytics: 'تحليلات', billing: 'فوترة', 'read:assistant': 'مساعد' }
const scopeColors = { full: '#ef4444', webhooks: '#f97316', analytics: '#006c35', billing: '#0a8244', 'read:assistant': '#1a9a52' }

function RotateModal({ keyRow, onClose, onDone }) {
    const [newKey, setNewKey] = useState(keyRow?.key || '')
    const [copied, setCopied] = useState(false)

    function copyKey() {
        navigator.clipboard.writeText(newKey).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'grid', placeItems: 'center', padding: 20,
        }} onClick={onClose}>
            <div className="card" style={{ width: 'min(480px, 100%)' }} onClick={e => e.stopPropagation()}>
                <div className="card-head"><h3>مفتاح جديد — {keyRow?.name}</h3></div>
                <div className="card-body">
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
                        انسخ المفتاح الآن — لن يُعرض مرة أخرى.
                    </p>
                    <code style={{
                        display: 'block', padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                        fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all', direction: 'ltr',
                    }}>{newKey}</code>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="btn btn-primary btn-sm" onClick={copyKey}>
                            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'تم النسخ' : 'نسخ المفتاح'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { onDone(); onClose() }}>تم</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ApiKeys() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState('all')
    const [busy, setBusy] = useState(null)
    const [rotatedKey, setRotatedKey] = useState(null)

    const reload = useCallback(() => {
        return api.getApiKeys().then(setData).catch(e => setError(e.message))
    }, [])

    useEffect(() => {
        reload()
    }, [reload])

    async function handleRevoke(id) {
        if (!confirm('إلغاء هذا المفتاح؟ لن يعمل في الويدجت بعد الآن.')) return
        setBusy(id)
        try {
            await api.revokeApiKey(id)
            await reload()
        } catch (e) {
            alert(e.message)
        } finally {
            setBusy(null)
        }
    }

    async function handleRotate(id) {
        if (!confirm('تدوير المفتاح؟ سيُلغى المفتاح الحالي ويُنشأ مفتاح جديد.')) return
        setBusy(id)
        try {
            const result = await api.rotateApiKey(id)
            setRotatedKey(result)
            await reload()
        } catch (e) {
            alert(e.message)
        } finally {
            setBusy(null)
        }
    }

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const { keys: platformApiKeys, stats } = data
    const apiKeyStats = {
        totalKeys: stats.totalKeys,
        activeKeys: stats.activeKeys,
        totalCalls24h: stats.totalCalls24h,
        avgLatency: stats.avgLatency,
        topEndpoints: stats.topEndpoints || [],
    }

    const filtered = filter === 'all' ? platformApiKeys : platformApiKeys.filter(k => k.status === filter)

    return (
        <>
            {rotatedKey && (
                <RotateModal
                    keyRow={rotatedKey}
                    onClose={() => setRotatedKey(null)}
                    onDone={reload}
                />
            )}

            <div className="topbar">
                <div className="topbar-left">
                    <h1>🔑 مفاتيح API</h1>
                    <p>إدارة مفاتيح API للمشتركين — إلغاء وتدوير</p>
                </div>
            </div>

            <div className="stats-row">
                {[
                    { label: 'إجمالي المفاتيح', value: apiKeyStats.totalKeys, icon: Key, color: 'red', st: 'st-red' },
                    { label: 'مفاتيح نشطة', value: apiKeyStats.activeKeys, icon: ShieldCheck, color: 'green', st: 'st-green' },
                    { label: 'استدعاءات ٢٤ ساعة', value: apiKeyStats.totalCalls24h, icon: Zap, color: 'purple', st: 'st-purple' },
                    { label: 'متوسط الاستجابة', value: apiKeyStats.avgLatency, icon: Clock, color: 'blue', st: 'st-blue' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.st}`}>
                        <div className="stat-top">
                            <div className={`stat-icon ${s.color}`}><s.icon size={18} /></div>
                        </div>
                        <div className="stat-val">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid-2-1" style={{ marginBottom: 24 }}>
                <div className="card">
                    <div className="card-head"><h3>أكثر نقاط النهاية استخداماً</h3></div>
                    <div className="card-body">
                        {apiKeyStats.topEndpoints.length ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={apiKeyStats.topEndpoints} layout="vertical">
                                    <XAxis type="number" tick={{ fontSize: 11, fill: '#757ba3' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                                    <YAxis type="category" dataKey="endpoint" width={180} tick={{ fontSize: 11, fill: '#b0b5cc', direction: 'ltr', textAnchor: 'end' }} />
                                    <Tooltip formatter={v => `${(v / 1000).toFixed(1)}K calls`} contentStyle={{ background: '#13151f', border: '1px solid #1e2035', borderRadius: 8, fontSize: 12 }} />
                                    <Bar dataKey="calls" radius={[0, 4, 4, 0]}>
                                        {apiKeyStats.topEndpoints.map((_, i) => (
                                            <Cell key={i} fill={['#ef4444', '#f97316', '#006c35', '#0a8244', '#1a9a52'][i]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>لا توجد بيانات بعد</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-head"><h3>توزيع الصلاحيات</h3></div>
                    <div className="card-body">
                        {Object.entries(scopeLabels).map(([scope, label]) => {
                            const count = platformApiKeys.filter(k => k.scope === scope && k.status === 'active').length
                            return (
                                <div key={scope} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: 4, background: scopeColors[scope] }} />
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                                    </div>
                                    <span className="badge badge-purple">{count} مفتاح</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                    { key: 'all', label: 'الكل' },
                    { key: 'active', label: 'نشط' },
                    { key: 'revoked', label: 'مُلغى' },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>المفتاح</th>
                                    <th>الصلاحية</th>
                                    <th>الحالة</th>
                                    <th>آخر استخدام</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(k => (
                                    <tr key={k.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{k.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{k.tenant || '—'} · {k.created}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <code style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 4, direction: 'ltr' }}>
                                                    {k.key}
                                                </code>
                                            </div>
                                        </td>
                                        <td><span style={{ fontSize: 12, fontWeight: 600, color: scopeColors[k.scope] || 'var(--text-3)' }}>{scopeLabels[k.scope] || k.scope}</span></td>
                                        <td>
                                            <span className={`badge ${k.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                                                <span className="dot" /> {k.status === 'active' ? 'نشط' : 'مُلغى'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{k.lastUsed}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button
                                                    className="btn btn-xs btn-secondary"
                                                    disabled={busy === k.id || k.status !== 'active'}
                                                    onClick={() => handleRotate(k.id)}
                                                >
                                                    <RefreshCw size={11} /> {busy === k.id ? '...' : 'تدوير'}
                                                </button>
                                                {k.status === 'active' && (
                                                    <button
                                                        className="btn btn-xs btn-danger"
                                                        disabled={busy === k.id}
                                                        onClick={() => handleRevoke(k.id)}
                                                    >
                                                        <Trash2 size={11} /> إلغاء
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}
