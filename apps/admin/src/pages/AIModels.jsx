import { useState, useEffect } from 'react'
import {
    Brain, Zap, DollarSign, AlertTriangle,
    CheckCircle2, Activity, XCircle, Key, Save, Eye, EyeOff,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { api } from '../api'
import ChartTip from '@wba/dashboard-ui/ChartTip'

const PALETTE = ['#006c35', '#0a8244', '#1a9a52', '#f97316', '#fbbf24', '#004d26', '#ef4444']

function formatTokens(n) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return String(n ?? 0)
}

function formatRequests(n) {
    if (!n) return '0'
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
}

function formatCost(n) {
    if (!n) return '$0'
    if (n < 0.01) return '<$0.01'
    return `$${n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProviderBadge({ ok, label }) {
    return (
        <span className={`badge ${ok ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
            {ok ? <CheckCircle2 size={10} style={{ marginInlineEnd: 4, verticalAlign: -1 }} /> : <XCircle size={10} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />}
            {label}
        </span>
    )
}

function sourceLabel(source) {
    if (source === 'database') return 'قاعدة البيانات'
    if (source === 'env') return 'ملف .env'
    return 'غير مضبوط'
}

function ProviderKeysEditor({ aiStatus, onSaved }) {
    const pk = aiStatus.providerKeys || {}
    const [editing, setEditing] = useState(false)
    const [groqKey, setGroqKey] = useState('')
    const [geminiKey, setGeminiKey] = useState('')
    const [aiProvider, setAiProvider] = useState(aiStatus.aiProvider || 'auto')
    const [showGroq, setShowGroq] = useState(false)
    const [showGemini, setShowGemini] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    async function save() {
        setSaving(true)
        setMsg('')
        try {
            const payload = { aiProvider }
            if (groqKey !== '') payload.groqApiKey = groqKey.trim()
            if (geminiKey !== '') payload.geminiApiKey = geminiKey.trim()
            await api.updateAiProviderKeys(payload)
            setGroqKey('')
            setGeminiKey('')
            setMsg('تم تحديث المفاتيح بنجاح')
            setEditing(false)
            onSaved?.()
        } catch (e) {
            setMsg(e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: editing ? 12 : 0 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
                    <span><Key size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />Groq: <code style={{ fontFamily: 'var(--mono)' }}>{pk.groq?.masked || '—'}</code> <span style={{ color: 'var(--text-4)' }}>({sourceLabel(pk.groq?.source)})</span></span>
                    <span>Gemini: <code style={{ fontFamily: 'var(--mono)' }}>{pk.gemini?.masked || '—'}</code> <span style={{ color: 'var(--text-4)' }}>({sourceLabel(pk.gemini?.source)})</span></span>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(v => !v)}>
                    <Key size={13} /> {editing ? 'إلغاء' : 'تحديث المفاتيح'}
                </button>
            </div>

            {editing && (
                <div style={{ display: 'grid', gap: 12 }}>
                    <div className="field" style={{ margin: 0 }}>
                        <label className="field-label">مفتاح Groq (GROQ_API_KEY)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                className="input"
                                type={showGroq ? 'text' : 'password'}
                                placeholder={pk.groq?.configured ? 'اتركه فارغاً للإبقاء على المفتاح الحالي' : 'gsk_...'}
                                value={groqKey}
                                onChange={e => setGroqKey(e.target.value)}
                                style={{ fontFamily: 'var(--mono)', direction: 'ltr' }}
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowGroq(v => !v)}>
                                {showGroq ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                        <label className="field-label">مفتاح Gemini (GEMINI_API_KEY)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                className="input"
                                type={showGemini ? 'text' : 'password'}
                                placeholder={pk.gemini?.configured ? 'اتركه فارغاً للإبقاء على المفتاح الحالي' : 'AI...'}
                                value={geminiKey}
                                onChange={e => setGeminiKey(e.target.value)}
                                style={{ fontFamily: 'var(--mono)', direction: 'ltr' }}
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowGemini(v => !v)}>
                                {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                        <label className="field-label">وضع المزود</label>
                        <select className="input" value={aiProvider} onChange={e => setAiProvider(e.target.value)}>
                            <option value="auto">auto — Groq أولاً ثم Gemini</option>
                            <option value="groq">groq فقط</option>
                            <option value="gemini">gemini فقط</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                            <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ المفاتيح'}
                        </button>
                        {msg && <span style={{ fontSize: 12, color: msg.includes('نجاح') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
                        المفاتيح تُخزَّن في قاعدة البيانات وتُطبَّق فوراً. اترك الحقل فارغاً للإبقاء على المفتاح الحالي.
                    </p>
                </div>
            )}
            {!editing && msg && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)' }}>{msg}</div>
            )}
        </div>
    )
}

export default function AIModels() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')

    const reload = () => api.getAiModels().then(setData).catch(e => setError(e.message))

    useEffect(() => {
        reload()
    }, [])

    if (!data && !error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--text-3)' }}>جاري التحميل...</div>
    }
    if (error) {
        return <div className="page-wrap" style={{ padding: 40, color: 'var(--red)' }}>{error}</div>
    }

    const {
        aiModels = [],
        modelUsageHistory = [],
        chartModels = [],
        summary = {},
        aiStatus = {},
    } = data

    const modelColors = Object.fromEntries(
        (chartModels.length ? chartModels : aiModels).map((m, i) => [m.id, PALETTE[i % PALETTE.length]])
    )
    const totalCost = aiModels.reduce((s, m) => s + (m.cost_24h || 0), 0)
    const totalTokens = aiModels.reduce((s, m) => s + (m.tokens_24h || 0), 0)
    const totalRequests = summary.total_requests_24h ?? aiModels.reduce((s, m) => s + (m.requests_24h || 0), 0)
    const errors24h = summary.errors_24h || 0
    const errorRate = summary.platform_error_rate || 0
    const maxRequests = Math.max(...aiModels.map(m => m.requests_24h || 0), 1)

    const costPieData = aiModels
        .filter(m => (m.cost_24h || 0) > 0)
        .map(m => ({ name: m.name, value: m.cost_24h || 0, color: modelColors[m.id] }))

    const barModels = chartModels.length
        ? chartModels
        : aiModels.slice(0, 6).map(m => ({ id: m.id, name: m.name }))

    const providersOk = [aiStatus.groq, aiStatus.gemini].filter(Boolean).length

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>نماذج الذكاء الاصطناعي</h1>
                    <p>مراقبة استخدام وتكاليف وأداء نماذج AI عبر المنصة</p>
                </div>
                <div className="topbar-right">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                        background: aiStatus.configured ? 'var(--green-muted)' : 'var(--red-muted)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 12.5, fontWeight: 600,
                        color: aiStatus.configured ? 'var(--green)' : 'var(--red)',
                    }}>
                        <span className="dot" style={{ background: aiStatus.configured ? 'var(--green)' : 'var(--red)' }} />
                        {aiStatus.configured ? `${providersOk} مزوّد متصل` : 'AI غير مضبوط'}
                    </div>
                </div>
            </div>

            {/* Provider status */}
            <div className="card anim-in" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 6 }}>مزوّدو AI</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <ProviderBadge ok={aiStatus.groq} label="Groq" />
                                <ProviderBadge ok={aiStatus.gemini} label="Gemini" />
                                <span className="badge badge-purple" style={{ fontSize: 10 }}>
                                    الوضع: {aiStatus.aiProvider || 'auto'}
                                </span>
                            </div>
                        </div>
                        <div style={{ minWidth: 180 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4 }}>النموذج الافتراضي</div>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}>{aiStatus.defaultModel || '—'}</div>
                        </div>
                        {aiStatus.groq && (
                            <div style={{ minWidth: 160 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4 }}>نموذج Groq</div>
                                <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{aiStatus.groqModel}</div>
                            </div>
                        )}
                        {aiStatus.gemini && (
                            <div style={{ minWidth: 160 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4 }}>نموذج Gemini</div>
                                <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{aiStatus.geminiModel}</div>
                            </div>
                        )}
                    </div>
                    <ProviderKeysEditor aiStatus={aiStatus} onSaved={reload} />
                </div>
            </div>

            {/* Summary KPIs */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
                {[
                    { icon: Brain, label: 'النماذج النشطة', val: aiModels.length, color: 'purple' },
                    { icon: Zap, label: 'الرموز/٢٤ساعة', val: formatTokens(totalTokens), color: 'blue' },
                    { icon: DollarSign, label: 'التكلفة/٢٤ساعة', val: formatCost(totalCost), color: 'green' },
                    { icon: Activity, label: 'الطلبات/٢٤ساعة', val: formatRequests(totalRequests), color: 'amber' },
                    { icon: AlertTriangle, label: 'أخطاء/٢٤ساعة', val: errors24h, color: 'red', sub: `${errorRate}٪` },
                ].map((s, i) => (
                    <div key={i} className={`stat-card st-${s.color} anim-in`}>
                        <div className="stat-top"><div className={`stat-icon ${s.color}`}><s.icon size={17} /></div></div>
                        <div className="stat-val">{s.val}</div>
                        <div className="stat-label">{s.label}{s.sub ? ` · ${s.sub}` : ''}</div>
                    </div>
                ))}
            </div>

            {/* Model cards */}
            {aiModels.length === 0 ? (
                <div className="card anim-in" style={{ marginBottom: 20 }}>
                    <div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                        <Brain size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>لا توجد بيانات استخدام بعد</div>
                        <div style={{ fontSize: 13 }}>ستظهر إحصائيات النماذج عند بدء محادثات المساعد الذكي</div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
                    {aiModels.map(m => (
                        <div key={m.id} className="card anim-in" style={{ borderTop: `3px solid ${modelColors[m.id] || PALETTE[0]}` }}>
                            <div className="card-body" style={{ padding: '16px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: `${modelColors[m.id] || PALETTE[0]}15`,
                                        display: 'grid', placeItems: 'center',
                                    }}>
                                        <Brain size={18} color={modelColors[m.id] || PALETTE[0]} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</div>
                                    </div>
                                    <span className="badge badge-green" style={{ fontSize: 10, flexShrink: 0 }}>
                                        <span className="dot" /> {m.provider}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                    <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>الرموز/٢٤ س</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--mono)' }}>{formatTokens(m.tokens_24h)}</div>
                                    </div>
                                    <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>التكلفة/٢٤ س</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--green)' }}>{formatCost(m.cost_24h)}</div>
                                    </div>
                                    <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>التأخير</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--mono)', color: m.latency > 5000 ? 'var(--amber)' : 'var(--text-1)' }}>{m.latency}ms</div>
                                    </div>
                                    <div style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-xs)' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>الطلبات/٢٤ س</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--mono)' }}>{formatRequests(m.requests_24h)}</div>
                                    </div>
                                </div>

                                <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-4)', marginBottom: 4 }}>
                                        <span>حصة الاستخدام</span>
                                        <span style={{ fontFamily: 'var(--mono)' }}>{Math.round(((m.requests_24h || 0) / maxRequests) * 100)}٪</span>
                                    </div>
                                    <div className="progress" style={{ height: 6 }}>
                                        <div className="progress-fill purple" style={{ width: `${Math.min(100, ((m.requests_24h || 0) / maxRequests) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Charts */}
            <div className="grid-2">
                <div className="card anim-in">
                    <div className="card-head"><h3>استخدام الرموز اليومي (K)</h3></div>
                    <div className="card-body" style={{ height: 280 }}>
                        {modelUsageHistory.length && barModels.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={modelUsageHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                                    <XAxis dataKey="date" stroke="var(--text-4)" fontSize={11} tickLine={false} reversed />
                                    <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} orientation="right" unit="K" />
                                    <Tooltip content={<ChartTip />} />
                                    {barModels.map((m, i) => (
                                        <Bar
                                            key={m.id}
                                            dataKey={m.id}
                                            name={m.name}
                                            fill={modelColors[m.id] || PALETTE[i % PALETTE.length]}
                                            radius={[2, 2, 0, 0]}
                                            stackId="a"
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-4)', fontSize: 13 }}>
                                لا توجد بيانات تاريخية بعد
                            </div>
                        )}
                    </div>
                    {barModels.length > 0 && (
                        <div className="card-foot" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            {barModels.map((m, i) => (
                                <span key={m.id} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                    <span style={{
                                        display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                                        background: modelColors[m.id] || PALETTE[i % PALETTE.length],
                                        marginInlineEnd: 5, verticalAlign: -1,
                                    }} />
                                    {m.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card anim-in">
                    <div className="card-head"><h3>توزيع التكاليف</h3></div>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {costPieData.length ? (
                            <>
                                <div style={{ width: 150, height: 150 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={costPieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                                                {costPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ flex: 1 }}>
                                    {aiModels.map((m, i) => (
                                        <div key={m.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                                            borderBottom: i < aiModels.length - 1 ? '1px solid var(--border-1)' : 'none',
                                        }}>
                                            <span style={{ width: 10, height: 10, borderRadius: 3, background: modelColors[m.id] || PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                                            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{m.name}</span>
                                            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)' }}>{formatCost(m.cost_24h)}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{totalCost ? Math.round(((m.cost_24h || 0) / totalCost) * 100) : 0}٪</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '2px solid var(--border-2)', marginTop: 4 }}>
                                        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>المجموع اليومي</span>
                                        <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--mono)', color: 'var(--green)' }}>{formatCost(totalCost)}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: 24, color: 'var(--text-4)', fontSize: 13, width: '100%', textAlign: 'center' }}>
                                التكاليف تُقدَّر من حجم الرموز — ستظهر بعد أول استخدام
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Monthly projection */}
            <div className="card anim-in" style={{ marginTop: 20 }}>
                <div className="card-head"><h3>التوقعات الشهرية</h3></div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                        {[
                            { label: 'التكلفة الشهرية المتوقعة', val: formatCost(totalCost * 30), desc: 'بناءً على متوسط آخر ٢٤ ساعة' },
                            { label: 'معدل الخطأ', val: `${errorRate}٪`, desc: `${errors24h} خطأ من ${formatRequests(totalRequests)} طلب` },
                            { label: 'التكلفة/١٠٠٠ استعلام', val: totalRequests ? formatCost(totalCost / (totalRequests / 1000)) : '—', desc: 'متوسط التكلفة المختلطة' },
                            { label: 'الطلبات الشهرية المتوقعة', val: formatRequests(totalRequests * 30), desc: 'إجمالي كل النماذج' },
                        ].map((m, i) => (
                            <div key={i} style={{ padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-1)', marginBottom: 4 }}>{m.val}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{m.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
