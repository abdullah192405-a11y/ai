import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Key, Plus, Copy, Shield, Trash2,
    Activity, AlertTriangle, Check,
} from 'lucide-react'
import { api } from '../api'
import PlanLimitBanner from '../components/PlanLimitBanner'
import { formatDate } from '@wba/dashboard-ui/formatDate'
import { rememberEmbedKey } from '../lib/setupSteps'

function CreateKeyModal({ onClose, onCreated, websiteId }) {
    const [name, setName] = useState('مساعد الموقع')
    const [generated, setGenerated] = useState(null)
    const [copied, setCopied] = useState(false)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    const create = async () => {
        setCreating(true)
        setError('')
        try {
            const res = await api.createKey(name.trim(), ['read:assistant'])
            setGenerated(res.key)
            rememberEmbedKey(res.key, websiteId)
            onCreated?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setCreating(false)
        }
    }

    const copy = (text, setter) => {
        navigator.clipboard.writeText(text)
        setter(true)
        setTimeout(() => setter(false), 2000)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h2>{generated ? 'تم إنشاء المفتاح' : 'إنشاء مفتاح الربط'}</h2>
                    <p>{generated ? 'انسخه الآن ثم ثبّته على موقعك — لن يُعرض مرة أخرى' : 'اسم بسيط يكفي. سنستخدمه داخل كود التثبيت.'}</p>
                </div>
                <div className="modal-body">
                    {!generated ? (
                        <>
                            <div className="field">
                                <label className="field-label">اسم يظهر لك فقط</label>
                                <input className="input" placeholder="مثال: متجر سلة" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            {error && (
                                <div style={{ fontSize: 12.5, color: '#f87171', marginTop: 4 }}>{error}</div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{
                                padding: '14px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--green-muted)', border: '1px solid rgba(52,211,153,0.15)',
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                            }}>
                                <Check size={16} style={{ color: 'var(--green)' }} />
                                <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>تم إنشاء المفتاح بنجاح</span>
                            </div>
                            <div className="code" style={{ wordBreak: 'break-all' }}>
                                <code style={{ fontSize: 11.5, direction: 'ltr' }}>{generated}</code>
                                <button className="btn btn-ghost btn-xs" onClick={() => copy(generated, setCopied)}>
                                    {copied ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                            </div>

<div style={{
                                marginTop: 12, padding: '12px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--amber-muted)', border: '1px solid rgba(251,191,36,0.15)',
                                fontSize: 12.5, color: 'var(--amber)', lineHeight: 1.6,
                            }}>
                                <AlertTriangle size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                                <strong>أمان:</strong> احفظ هذا المفتاح في مكان آمن. سيُعرض مرة واحدة فقط.
                            </div>
                        </>
                    )}
                </div>
                <div className="modal-foot">
                    {generated ? (
                        <>
                            <Link to="/install" className="btn btn-primary">ثبّت على الموقع الآن</Link>
                            <button className="btn btn-secondary" onClick={onClose}>لاحقاً</button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                            <button className="btn btn-primary" onClick={create} disabled={!name.trim() || creating}>
                                <Key size={14} /> {creating ? 'جاري الإنشاء...' : 'إنشاء المفتاح'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ApiKeys({ user }) {
    const [showCreate, setShowCreate] = useState(false)
    const [keys, setKeys] = useState([])
    const [usage, setUsage] = useState(null)
    const [websites, setWebsites] = useState([])
    const [loading, setLoading] = useState(true)

    const load = () => {
        setLoading(true)
        Promise.all([
            api.getKeys(),
            api.getUsage().catch(() => null),
            api.getWebsites().catch(() => []),
        ])
            .then(([keyRows, usageData, siteRows]) => {
                setKeys(keyRows)
                setUsage(usageData)
                setWebsites(siteRows)
            })
            .catch(err => console.error('load keys failed:', err.message))
            .finally(() => setLoading(false))
    }

    useEffect(load, [user?.websiteId])

    const revoke = async (id) => {
        if (!confirm('إلغاء هذا المفتاح؟ لن يعمل بعد ذلك.')) return
        try {
            await api.revokeKey(id)
            load()
        } catch (err) {
            alert('تعذر الإلغاء: ' + err.message)
        }
    }

    const active = keys.filter(k => !k.revoked)
    const atKeyLimit =
        usage?.limits?.apiKeys != null && usage.used.apiKeys >= usage.limits.apiKeys
    const widgetActiveSites = websites.filter((w) => w.widgetEnabled)
    const keysForActiveSites = active.filter((k) => {
        const site = websites.find((w) => w.id === k.website_id)
        return site?.widgetEnabled
    })

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <h1>مفاتيح الربط</h1>
                    <p>
                      مفتاح واحد يُلصق داخل كود التثبيت ليربط المساعد بمتجرك
                      {usage?.planLabel && <> — باقة {usage.planLabel}</>}
                    </p>
                </div>
                <div className="topbar-right">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreate(true)}
                        disabled={atKeyLimit}
                        title={atKeyLimit ? 'وصلت حد مفاتيح الباقة' : undefined}
                    >
                        <Plus size={15} /> إنشاء مفتاح
                    </button>
                </div>
            </div>

            <PlanLimitBanner usage={usage} kind="apiKeys" />

            <div className="card anim-in" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
                    بعد إنشاء المفتاح، انتقل إلى{' '}
                    <Link to="/install" style={{ color: 'var(--accent)', fontWeight: 700 }}>ثبّت على الموقع</Link>
                    {' '}واختر منصتك (سلة، زد، ووردبريس…). الصق المفتاح هناك ليظهر داخل الكود جاهزاً للنسخ.
                </div>
            </div>



            <div className="card anim-in" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: 'var(--gradient-subtle)', borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                }}>
                    <div className="stat-icon purple"><Shield size={18} /></div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>أفضل ممارسات الأمان</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                        إدارة مفاتيح الربط. المفتاح الظاهر في المتصفح مخصص لكود التثبيت فقط — لا تشاركه.
                        </div>
                    </div>
                </div>
            </div>

            <div className="card anim-in">
                <div className="card-head">
                    <h3>المفاتيح النشطة ({active.length})</h3>
                </div>
                <div className="tbl-wrap">
                    <table>
                        <thead>
                            <tr><th>الاسم</th><th>المفتاح</th><th>الصلاحيات</th><th>الحالة</th><th>آخر استخدام</th><th>أُنشئ</th><th></th></tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>جاري التحميل...</td></tr>
                            ) : keys.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>لا توجد مفاتيح بعد — أنشئ مفتاحاً للبدء.</td></tr>
                            ) : keys.map(k => (
                                <tr key={k.id}>
                                    <td style={{ fontWeight: 600 }}>{k.name}</td>
                                    <td><code style={{ fontSize: 12, color: 'var(--accent-3)', background: 'var(--bg-4)', padding: '2px 8px', borderRadius: 4, direction: 'ltr' }}>{k.key_prefix}…</code></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                            {(k.scopes || []).map(s => <span key={s} className="badge badge-purple" style={{ fontSize: 10 }}>{s}</span>)}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${!k.revoked ? 'badge-green' : 'badge-red'}`}>
                                            <span className="dot" /> {!k.revoked ? 'نشط' : 'مُلغى'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                                        {k.last_used_at ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <Activity size={12} style={{ color: 'var(--green)' }} /> {formatDate(k.last_used_at)}
                                            </span>
                                        ) : 'لم يُستخدم'}
                                    </td>
                                    <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{formatDate(k.created_at)}</td>
                                    <td>
                                        {!k.revoked && (
                                            <button className="btn btn-danger btn-xs" onClick={() => revoke(k.id)}><Trash2 size={11} /> إلغاء</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreate && (
              <CreateKeyModal
                onClose={() => setShowCreate(false)}
                onCreated={load}
                websiteId={user?.websiteId}
              />
            )}
        </>
    )
}
