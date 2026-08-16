import { useState, useEffect } from 'react'
import { Settings, ToggleRight, ToggleLeft, Gauge, Database, Globe, Cpu, Lock, Zap, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '../api'

const categoryColors = { 'AI': '#ef4444', 'ويدجت': '#f97316', 'تحليلات': '#006c35', 'أمان': '#0a8244', 'API': '#1a9a52', 'نظام': '#fbbf24' }

const DEFAULT_SETTINGS = {
    trialDays: 14,
    globalRateLimit: 100,
    defaultModel: 'gpt-4o-mini',
    signupsEnabled: true,
    maintenanceMode: false,
    maxQueriesPerPlan: { مبتدئ: 10000, احترافي: 100000, مؤسسي: '∞' },
    maxWebsitesPerPlan: { مبتدئ: 3, احترافي: 10, مؤسسي: '∞' },
    maxDocumentsPerPlan: { مبتدئ: 500, احترافي: 5000, مؤسسي: '∞' },
}

export default function PlatformSettings() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [flags, setFlags] = useState([])
    const [settings, setSettings] = useState(DEFAULT_SETTINGS)

    useEffect(() => {
        api.getPlatformSettings()
            .then((res) => {
                setData(res)
                setFlags(res.featureFlags || [])
                setSettings(prev => ({
                    ...prev,
                    ...res,
                    signupsEnabled: res.signupEnabled ?? prev.signupsEnabled,
                    maintenanceMode: res.maintenanceMode ?? prev.maintenanceMode,
                }))
            })
            .catch(e => setError(e.message))
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const toggleFlag = id => {
        setFlags(prev => prev.map(f => f.id === id ? { ...f, status: !f.status } : f))
    }

    const activeFlags = flags.filter(f => f.status).length

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>⚙️ إعدادات المنصة</h1>
                    <p>إدارة الميزات والأعلام والإعدادات العامة للمنصة</p>
                </div>
                <div className="topbar-right">
                    <button className="btn btn-primary"><Save size={15} /> حفظ التغييرات</button>
                </div>
            </div>

            <div className="stats-row">
                {[
                    { label: 'Feature Flags نشطة', value: flags.length ? `${activeFlags}/${flags.length}` : '—', icon: ToggleRight, color: 'green', st: 'st-green' },
                    { label: 'أيام التجربة', value: settings.trialDays ?? '—', icon: Clock, color: 'blue', st: 'st-blue' },
                    { label: 'حد المعدل العام', value: settings.globalRateLimit != null ? `${settings.globalRateLimit.toLocaleString()}/ث` : '—', icon: Gauge, color: 'amber', st: 'st-amber' },
                    { label: 'النموذج الافتراضي', value: settings.defaultModel || '—', icon: Cpu, color: 'red', st: 'st-red' },
                ].map((s, i) => (
                    <div key={i} className={`stat-card ${s.st}`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={18} /></div></div>
                        <div className="stat-val" style={{ fontSize: String(s.value).length > 10 ? 20 : 28 }}>{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid-2" style={{ alignItems: 'start' }}>
                <div className="card">
                    <div className="card-head"><h3>🏴 Feature Flags ({flags.length})</h3></div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {flags.length === 0 && (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>لا توجد أعلام ميزات</div>
                        )}
                        {flags.map(f => (
                            <div key={f.id} style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px',
                                borderBottom: '1px solid var(--border-1)', transition: 'background 120ms',
                                opacity: f.status ? 1 : 0.6,
                            }}>
                                <button onClick={() => toggleFlag(f.id)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: f.status ? 'var(--green)' : 'var(--text-4)' }}>
                                    {f.status ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <code style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4, direction: 'ltr' }}>{f.name}</code>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${categoryColors[f.category]}15`, color: categoryColors[f.category] }}>{f.category}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{f.description}</div>
                                </div>
                                <div style={{ textAlign: 'center', minWidth: 60 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: f.rollout === 100 ? 'var(--green)' : f.rollout > 0 ? 'var(--amber)' : 'var(--text-4)' }}>
                                        {f.rollout}%
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-4)' }}>نشر</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-head"><h3>الإعدادات العامة</h3></div>
                        <div className="card-body">
                            <div className="field">
                                <label className="field-label">أيام الفترة التجريبية</label>
                                <input className="input" type="number" value={settings.trialDays ?? ''} onChange={e => setSettings(s => ({ ...s, trialDays: +e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">حد المعدل العام (طلب/ثانية)</label>
                                <input className="input" type="number" value={settings.globalRateLimit ?? ''} onChange={e => setSettings(s => ({ ...s, globalRateLimit: +e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-1)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>التسجيلات الجديدة</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>السماح بتسجيل مشتركين جدد</div>
                                </div>
                                <button onClick={() => setSettings(s => ({ ...s, signupsEnabled: !s.signupsEnabled }))}
                                    style={{ color: settings.signupsEnabled ? 'var(--green)' : 'var(--text-4)' }}>
                                    {settings.signupsEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: settings.maintenanceMode ? 'var(--red)' : 'inherit' }}>وضع الصيانة</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>يعطّل الوصول للمشتركين مع عرض رسالة</div>
                                </div>
                                <button onClick={() => setSettings(s => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                                    style={{ color: settings.maintenanceMode ? 'var(--red)' : 'var(--text-4)' }}>
                                    {settings.maintenanceMode ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                </button>
                            </div>
                            {settings.maintenanceMode && (
                                <div style={{ padding: 12, background: 'var(--red-muted)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--red)', marginTop: 8 }}>
                                    <AlertTriangle size={14} /> وضع الصيانة مفعّل — لن يتمكن المشتركون من الوصول
                                </div>
                            )}
                        </div>
                    </div>

                    {settings.maxQueriesPerPlan && (
                        <div className="card">
                            <div className="card-head"><h3>حدود الباقات</h3></div>
                            <div className="card-body">
                                <table>
                                    <thead>
                                        <tr><th></th><th>مبتدئ</th><th>احترافي</th><th>مؤسسي</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ fontWeight: 600, fontSize: 12 }}>الاستعلامات/شهر</td>
                                            {['مبتدئ', 'احترافي', 'مؤسسي'].map(p => (
                                                <td key={p} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                                    {typeof settings.maxQueriesPerPlan[p] === 'number' ? settings.maxQueriesPerPlan[p].toLocaleString() : settings.maxQueriesPerPlan[p]}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 600, fontSize: 12 }}>المواقع</td>
                                            {['مبتدئ', 'احترافي', 'مؤسسي'].map(p => (
                                                <td key={p} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{settings.maxWebsitesPerPlan?.[p] ?? '—'}</td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 600, fontSize: 12 }}>المستندات</td>
                                            {['مبتدئ', 'احترافي', 'مؤسسي'].map(p => (
                                                <td key={p} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{settings.maxDocumentsPerPlan?.[p] ?? '—'}</td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

function Clock(props) {
    return (
        <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
