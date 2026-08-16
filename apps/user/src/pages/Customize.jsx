import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Palette, MessageSquare, Settings, Layout, Check,
    RotateCcw, Monitor, Smartphone, Minus, X, Send, Sparkles,
    ChevronDown, Plug,
} from 'lucide-react'
import {
  PRESET_COLORS,
  WIDGET_POSITIONS,
  FONT_OPTIONS,
  DEFAULT_WIDGET_EDITOR,
  normalizeWidgetConfig,
  resolveFontOption,
  googleFontStylesheetUrl,
  WIDGET_SHELL,
  widgetTextScale,
} from '@wba/widget-config'
import { api } from '../api'

const presetColors = PRESET_COLORS
const positions = WIDGET_POSITIONS
const models = [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq — موصى به)', provider: 'groq' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Groq — سريع)', provider: 'groq' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Groq)', provider: 'groq' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B (Groq)', provider: 'groq' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'gemini' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
]

function modelProviderHint(model) {
    const m = models.find(x => x.value === model)
    if (m?.provider === 'gemini') {
        return 'المزود: Gemini — يُفعَّل عند اختيار أي نموذج gemini-* (GEMINI_API_KEY على الخادم)'
    }
    return 'المزود: Groq — يُفعَّل عند اختيار Llama / Mixtral / Gemma (GROQ_API_KEY على الخادم)'
}

const DEFAULT_CFG = DEFAULT_WIDGET_EDITOR

function normalizeConfig(raw) {
    return normalizeWidgetConfig(raw, DEFAULT_CFG)
}

export default function Customize({ user, setupMode = false }) {
    const [cfg, setCfg] = useState(DEFAULT_CFG)
    const [defaults, setDefaults] = useState(null)
    const [tab, setTab] = useState('appearance')
    const [device, setDevice] = useState('desktop')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [advancedOpen, setAdvancedOpen] = useState(false)

    useEffect(() => {
        api.getConfig()
            .then(c => {
                const normalized = normalizeConfig(c)
                setCfg(normalized)
                setDefaults(normalized)
            })
            .catch(err => console.error('load config failed:', err.message))
    }, [user?.websiteId])

    const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))
    const reset = () => { if (defaults) setCfg({ ...defaults }) }
    const save = async () => {
        setSaving(true)
        try {
            const updated = await api.saveConfig(cfg)
            const normalized = normalizeConfig({ ...cfg, ...updated })
            setCfg(normalized)
            setDefaults(normalized)
            setSaved(true); setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            alert('تعذر الحفظ: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const tabItems = [
        { id: 'appearance', label: 'المظهر', icon: Palette },
        { id: 'messages', label: 'النصوص', icon: MessageSquare },
        { id: 'behavior', label: 'السلوك', icon: Settings },
        { id: 'layout', label: 'المكان', icon: Layout },
    ]

    const isDark = cfg.theme === 'dark'
    const previewFont = resolveFontOption(cfg.fontFamily)
    const textScale = widgetTextScale(cfg.baseFontSize)
    const scaled = (px) => `${px * textScale}px`

    useEffect(() => {
        const id = 'wba-preview-font'
        let link = document.getElementById(id)
        if (!link) {
            link = document.createElement('link')
            link.id = id
            link.rel = 'stylesheet'
            document.head.appendChild(link)
        }
        link.href = googleFontStylesheetUrl(cfg.fontFamily)
    }, [cfg.fontFamily])

    return (
        <>
            {!setupMode && (
                <div className="topbar">
                    <div className="topbar-left">
                        <h1>شكل المساعد</h1>
                        <p>اللون، الاسم، ورسالة الترحيب — كما سيراها زائر موقعك</p>
                    </div>
                    <div className="topbar-right">
                        <button className="btn btn-secondary" onClick={reset}><RotateCcw size={14} /> إعادة تعيين</button>
                        <button className="btn btn-primary" onClick={save} disabled={saving}>
                            <Check size={14} /> {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ' : 'حفظ التغييرات'}
                        </button>
                    </div>
                </div>
            )}

            <div className={`split-pane${setupMode ? ' split-pane-setup' : ''}`}>
                {/* ─── اللوحة اليمنى (الإعدادات) ─── */}
                <div className="split-left">
                    {setupMode && (
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-1)' }}>
                            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                                خصّص الشكل هنا. لتثبيت المساعد على سلة أو زد أو أي موقع، استخدم صفحة «ثبّت على الموقع».
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" onClick={reset}><RotateCcw size={13} /> إعادة تعيين</button>
                                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                                    <Check size={13} /> {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ' : 'حفظ'}
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="tabs" style={{ padding: '0 12px', marginBottom: 0 }}>
                        {tabItems.map(t => (
                            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                                <t.icon size={13} /> {t.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {tab === 'appearance' && (
                            <>
                                <div className="split-left-section">
                                    <div className="split-left-title">اللون الأساسي</div>
                                    <div className="color-grid">
                                        {presetColors.map(c => (
                                            <div
                                                key={c}
                                                className={`color-swatch ${cfg.color === c ? 'active' : ''}`}
                                                style={{ background: c }}
                                                onClick={() => set('color', c)}
                                            />
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                                        <input className="input" value={cfg.color} onChange={e => set('color', e.target.value)} style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12.5, direction: 'ltr', textAlign: 'left' }} />
                                        <input type="color" value={cfg.color} onChange={e => set('color', e.target.value)} style={{ width: 36, height: 36, border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer', padding: 0 }} />
                                    </div>
                                </div>

                                <div className="split-left-section">
                                    <div className="split-left-title">السمة</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {['dark', 'light'].map(t => (
                                            <button key={t} onClick={() => set('theme', t)} style={{
                                                flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                border: `2px solid ${cfg.theme === t ? 'var(--accent)' : 'var(--border-2)'}`,
                                                background: t === 'dark' ? '#1a1a2e' : '#f8f9fa',
                                                textAlign: 'center', transition: 'all 150ms',
                                            }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: t === 'dark' ? '#fff' : '#333' }}>
                                                    {t === 'dark' ? 'داكن' : 'فاتح'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="split-left-section">
                                    <div className="split-left-title">الخط</div>
                                    <div className="field">
                                        <label className="field-label">عائلة الخط</label>
                                        <select className="input" value={cfg.fontFamily || 'ibm-plex-arabic'} onChange={e => set('fontFamily', e.target.value)}>
                                            {FONT_OPTIONS.map(font => (
                                                <option key={font.id} value={font.id}>{font.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="field">
                                        <label className="field-label">حجم النص الأساسي: {cfg.baseFontSize ?? 14}px</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>صغير</span>
                                            <input type="range" min={12} max={18} value={cfg.baseFontSize ?? 14} onChange={e => set('baseFontSize', +e.target.value)} style={{ flex: 1, accentColor: cfg.color }} />
                                            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>كبير</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="split-left-section">
                                    <div className="split-left-title">حدة الزوايا</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>مربع</span>
                                        <input type="range" min={0} max={24} value={cfg.radius} onChange={e => set('radius', +e.target.value)} style={{ flex: 1, accentColor: cfg.color }} />
                                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>دائري</span>
                                    </div>
                                </div>

                                <div className="split-left-section">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div className="split-left-title" style={{ marginBottom: 2 }}>شعار WBA</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>إظهار "مدعوم من WBA"</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={cfg.showBranding} onChange={e => set('showBranding', e.target.checked)} />
                                            <span className="toggle-track" />
                                        </label>
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'messages' && (
                            <>
                                <div className="split-left-section">
                                    <div className="field">
                                        <label className="field-label">اسم البوت</label>
                                        <input className="input" value={cfg.botName} onChange={e => set('botName', e.target.value)} />
                                    </div>
                                    <div className="field">
                                        <label className="field-label">العنوان الفرعي</label>
                                        <input className="input" value={cfg.botSubtitle} onChange={e => set('botSubtitle', e.target.value)} />
                                    </div>
                                    <div className="field">
                                        <label className="field-label">رسالة الترحيب</label>
                                        <textarea className="input" value={cfg.welcomeMessage} onChange={e => set('welcomeMessage', e.target.value)} rows={3} />
                                    </div>
                                    <div className="field">
                                        <label className="field-label">نص مربع الإدخال</label>
                                        <input className="input" value={cfg.placeholder} onChange={e => set('placeholder', e.target.value)} />
                                    </div>
                                </div>
                                <div className="split-left-section">
                                    <div className="split-left-title">أسئلة مقترحة</div>
                                    {cfg.suggestedQuestions.map((q, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                            <input className="input" value={q} onChange={e => {
                                                const arr = [...cfg.suggestedQuestions]; arr[i] = e.target.value; set('suggestedQuestions', arr)
                                            }} style={{ flex: 1 }} />
                                            <button className="btn-icon btn-ghost" onClick={() => set('suggestedQuestions', cfg.suggestedQuestions.filter((_, j) => j !== i))} style={{ color: 'var(--red)' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {cfg.suggestedQuestions.length < 5 && (
                                        <button className="btn btn-secondary btn-xs" onClick={() => set('suggestedQuestions', [...cfg.suggestedQuestions, ''])} style={{ marginTop: 4 }}>
                                            + إضافة سؤال
                                        </button>
                                    )}
                                </div>
                            </>
                        )}

                        {tab === 'behavior' && (
                            <>
                                <div className="split-left-section">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <div>
                                            <div className="split-left-title" style={{ marginBottom: 2 }}>فتح تلقائي</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>فتح الويدجت تلقائياً للزوار الجدد</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={cfg.autoOpen} onChange={e => set('autoOpen', e.target.checked)} />
                                            <span className="toggle-track" />
                                        </label>
                                    </div>
                                    {cfg.autoOpen && (
                                        <div className="field">
                                            <label className="field-label">تأخير الفتح (ثواني)</label>
                                            <input type="number" className="input" value={cfg.autoOpenDelay} onChange={e => set('autoOpenDelay', +e.target.value)} min={1} max={60} style={{ direction: 'ltr', textAlign: 'left' }} />
                                        </div>
                                    )}
                                </div>
                                <div className="split-left-section">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div className="split-left-title" style={{ marginBottom: 2 }}>الإشعارات الصوتية</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>تشغيل صوت عند استلام رسالة</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={cfg.soundEnabled} onChange={e => set('soundEnabled', e.target.checked)} />
                                            <span className="toggle-track" />
                                        </label>
                                    </div>
                                </div>
                                <div className="split-left-section">
                                    <div className="field">
                                        <label className="field-label">لغة الرد</label>
                                        <select className="input" value={cfg.language || 'ar'} onChange={e => set('language', e.target.value)}>
                                            <option value="ar">العربية</option>
                                            <option value="en">English</option>
                                            <option value="auto">تلقائي (لغة السؤال)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="split-left-section">
                                    <button
                                        type="button"
                                        className="embed-tips-toggle"
                                        onClick={() => setAdvancedOpen((v) => !v)}
                                        style={{ width: '100%' }}
                                    >
                                        إعدادات متقدمة (اختياري)
                                        {advancedOpen ? <ChevronDown size={15} style={{ transform: 'rotate(180deg)' }} /> : <ChevronDown size={15} />}
                                    </button>
                                    {advancedOpen && (
                                        <div style={{ marginTop: 14 }}>
                                            <div className="field">
                                                <label className="field-label">رابط الموقع (لفهرسة المحتوى)</label>
                                                <input className="input" value={cfg.knowledgeBaseUrl || ''}
                                                    onChange={e => set('knowledgeBaseUrl', e.target.value)}
                                                    placeholder="https://mystore.sa"
                                                    style={{ direction: 'ltr', textAlign: 'left' }} />
                                                <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.6 }}>
                                                    عادة يُضبط من صفحة «علّم المساعد». غيّره هنا فقط إذا لزم.
                                                </div>
                                            </div>
                                            <div className="field">
                                                <label className="field-label">تعليمات خاصة للمساعد</label>
                                                <textarea className="input" rows={5}
                                                    value={cfg.systemPrompt || ''}
                                                    onChange={e => set('systemPrompt', e.target.value)}
                                                    placeholder="مثال: أنت مساعد لمتجري. أجب باختصار عن المنتجات والشحن..." />
                                            </div>
                                            <div className="field">
                                                <label className="field-label">نموذج الذكاء الاصطناعي</label>
                                                <select className="input" value={cfg.model || 'llama-3.3-70b-versatile'} onChange={e => set('model', e.target.value)}>
                                                    {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                                <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.6 }}>
                                                    {modelProviderHint(cfg.model)}
                                                </div>
                                            </div>
                                            <div className="field">
                                                <label className="field-label">أسلوب الرد: {cfg.temperature ?? 0.7}</label>
                                                <input type="range" min={0} max={1} step={0.1} value={cfg.temperature ?? 0.7} onChange={e => set('temperature', +e.target.value)} style={{ width: '100%', accentColor: cfg.color }} />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)' }}>
                                                    <span>ثابت ودقيق</span><span>أكثر حرية</span>
                                                </div>
                                            </div>
                                            <div className="field">
                                                <label className="field-label">أقصى عدد ردود في المحادثة</label>
                                                <input type="number" className="input" value={cfg.maxTurns ?? 20} onChange={e => set('maxTurns', +e.target.value)} min={5} max={100} style={{ direction: 'ltr', textAlign: 'left' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {tab === 'layout' && (
                            <>
                                <div className="split-left-section">
                                    <div className="split-left-title">موضع الويدجت</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {positions.map(p => (
                                            <button key={p.id} onClick={() => set('position', p.id)} style={{
                                                padding: '14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                border: `2px solid ${cfg.position === p.id ? 'var(--accent)' : 'var(--border-2)'}`,
                                                background: cfg.position === p.id ? 'var(--accent-muted)' : 'var(--bg-3)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                transition: 'all 150ms',
                                            }}>
                                                <div style={{
                                                    width: 44, height: 32, borderRadius: 4, border: '1px solid var(--border-2)',
                                                    position: 'relative', background: 'var(--bg-0)',
                                                }}>
                                                    <div style={{
                                                        width: 8, height: 8, borderRadius: 2, background: cfg.color,
                                                        position: 'absolute',
                                                        ...(p.id === 'bottom-left' ? { bottom: 3, left: 3 } :
                                                            p.id === 'bottom-right' ? { bottom: 3, right: 3 } :
                                                                p.id === 'top-left' ? { top: 3, left: 3 } :
                                                                    { top: 3, right: 3 }),
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: cfg.position === p.id ? 'var(--accent)' : 'var(--text-3)' }}>
                                                    {p.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="split-left-section">
                                    <div className="split-left-title">تثبيت على الموقع</div>
                                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: 10 }}>
                                        الشكل يُحفظ هنا ويظهر للزوار تلقائياً. لصق الكود على سلة أو زد أو أي منصة يكون من صفحة التثبيت.
                                    </p>
                                    {!setupMode && (
                                        <Link to="/install" className="btn btn-primary btn-sm">
                                            <Plug size={13} /> دليل التثبيت حسب المنصة
                                        </Link>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ─── المعاينة المباشرة ─── */}
                <div className="split-right">
                    {/* شريط الأدوات */}
                    <div style={{
                        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 4, background: 'var(--bg-3)', borderRadius: 'var(--radius-full)',
                        padding: 3, border: '1px solid var(--border-2)', zIndex: 10,
                    }}>
                        {[
                            { id: 'desktop', icon: Monitor, label: 'كمبيوتر' },
                            { id: 'mobile', icon: Smartphone, label: 'جوال' },
                        ].map(d => (
                            <button key={d.id} onClick={() => setDevice(d.id)} style={{
                                padding: '5px 14px', borderRadius: 'var(--radius-full)', fontSize: 11.5, fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: device === d.id ? 'var(--accent)' : 'transparent',
                                color: device === d.id ? '#fff' : 'var(--text-3)',
                                transition: 'all 150ms',
                            }}>
                                <d.icon size={13} /> {d.label}
                            </button>
                        ))}
                    </div>

                    {/* إطار المتصفح */}
                    <div style={{
                        width: device === 'mobile' ? 375 : 720,
                        height: device === 'mobile' ? 680 : 680,
                        background: isDark ? '#0d0d1a' : '#f5f5f5',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-2)',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow-lg)',
                        position: 'relative',
                        transition: 'width 300ms, height 300ms, background 200ms',
                    }}>
                        {/* شريط المتصفح */}
                        <div style={{
                            height: 32, background: isDark ? '#1a1a2e' : '#e8e8e8', display: 'flex', alignItems: 'center',
                            padding: '0 12px', gap: 6,
                        }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                            <div style={{
                                flex: 1, background: isDark ? '#252542' : '#fff', borderRadius: 4, height: 18,
                                margin: '0 12px', padding: '0 8px', fontSize: 10,
                                color: isDark ? '#666' : '#999', display: 'flex', alignItems: 'center',
                            }}>
                                acme-corp.com
                            </div>
                        </div>

                        {/* محتوى الصفحة */}
                        <div style={{
                            padding: 20, background: isDark ? '#0d0d1a' : '#fafafa',
                            height: 'calc(100% - 32px)', position: 'relative',
                            transition: 'background 200ms',
                        }}>
                            <div style={{ width: '65%', height: 10, background: isDark ? '#252542' : '#e0e0e0', borderRadius: 4, marginBottom: 8 }} />
                            <div style={{ width: '45%', height: 10, background: isDark ? '#1f1f3a' : '#e8e8e8', borderRadius: 4, marginBottom: 20 }} />
                            <div style={{ width: '80%', height: 6, background: isDark ? '#1a1a30' : '#eee', borderRadius: 3, marginBottom: 6 }} />
                            <div style={{ width: '70%', height: 6, background: isDark ? '#1a1a30' : '#eee', borderRadius: 3, marginBottom: 6 }} />
                            <div style={{ width: '90%', height: 6, background: isDark ? '#1a1a30' : '#eee', borderRadius: 3, marginBottom: 16 }} />
                            <div style={{ width: '50%', height: 6, background: isDark ? '#1a1a30' : '#eee', borderRadius: 3 }} />

                            {/* نافذة المحادثة */}
                            <div style={{
                                position: 'absolute',
                                width: device === 'mobile' ? 'calc(100% - 24px)' : WIDGET_SHELL.width,
                                height: device === 'mobile' ? 'calc(100% - 24px)' : WIDGET_SHELL.height,
                                borderRadius: cfg.radius,
                                overflow: 'hidden',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                display: 'flex', flexDirection: 'column',
                                direction: 'rtl',
                                fontFamily: previewFont.stack,
                                fontSize: 14,
                                lineHeight: 1.5,
                                ...(cfg.position === 'bottom-left' ? { bottom: 12, left: 12 } :
                                    cfg.position === 'bottom-right' ? { bottom: 12, right: 12 } :
                                        cfg.position === 'top-left' ? { top: 12, left: 12 } :
                                            { top: 12, right: 12 }),
                            }}>
                                {/* الرأس */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}dd)`,
                                    padding: '18px 20px', color: '#fff',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    flexShrink: 0, minHeight: 72, maxHeight: 72,
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{cfg.botName}</div>
                                        <div style={{ fontSize: 11.5, opacity: 0.85, lineHeight: 1.3 }}>{cfg.botSubtitle}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button style={{ color: '#fff', opacity: 0.7, cursor: 'default' }}><Minus size={16} /></button>
                                        <button style={{ color: '#fff', opacity: 0.7, cursor: 'default' }}><X size={16} /></button>
                                    </div>
                                </div>

                                {/* الرسائل */}
                                <div style={{
                                    flex: 1, padding: '14px 16px', overflowY: 'auto',
                                    background: isDark ? '#1a1a2e' : '#fff',
                                    display: 'flex', flexDirection: 'column', gap: 10,
                                }}>
                                    {/* رسالة الترحيب */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                            background: cfg.color, display: 'grid', placeItems: 'center',
                                        }}>
                                            <Sparkles size={13} color="#fff" />
                                        </div>
                                        <div style={{
                                            padding: '10px 14px', fontSize: scaled(13.5), lineHeight: 1.5,
                                            borderRadius: `${cfg.radius * 0.6}px`,
                                            background: isDark ? '#252542' : '#f3f4f6',
                                            color: isDark ? '#e0e0e0' : '#333',
                                            maxWidth: '85%',
                                        }}>
                                            {cfg.welcomeMessage}
                                        </div>
                                    </div>

                                    {/* أسئلة مقترحة */}
                                    {cfg.suggestedQuestions.filter(Boolean).length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                                            {cfg.suggestedQuestions.filter(Boolean).map((q, i) => (
                                                <div key={i} style={{
                                                    padding: '5px 11px', fontSize: scaled(12), lineHeight: 1.4, borderRadius: cfg.radius * 0.5,
                                                    border: `1px solid ${cfg.color}33`, color: cfg.color,
                                                    background: `${cfg.color}0a`, cursor: 'pointer',
                                                }}>
                                                    {q}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* مربع الإدخال */}
                                <div style={{
                                    padding: '12px 14px',
                                    borderTop: `1px solid ${isDark ? '#2a2a4a' : '#eee'}`,
                                    background: isDark ? '#1a1a2e' : '#fff',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    flexShrink: 0, minHeight: 62,
                                }}>
                                    <input
                                        readOnly placeholder={cfg.placeholder}
                                        style={{
                                            flex: 1, border: 'none', outline: 'none', fontSize: scaled(13.5), lineHeight: 1.4,
                                            background: 'transparent',
                                            color: isDark ? '#bbb' : '#999',
                                            textAlign: 'right',
                                        }}
                                    />
                                    <button style={{
                                        width: 30, height: 30, borderRadius: '50%',
                                        background: cfg.color, display: 'grid', placeItems: 'center',
                                        cursor: 'pointer', border: 'none', transform: 'scaleX(-1)',
                                    }}>
                                        <Send size={13} color="#fff" />
                                    </button>
                                </div>

                                {/* الشعار */}
                                {cfg.showBranding && (
                                    <div style={{
                                        textAlign: 'center', padding: '7px 12px', fontSize: scaled(10.5), lineHeight: 1.4,
                                        color: isDark ? '#555' : '#bbb',
                                        background: isDark ? '#15152a' : '#f9f9f9',
                                    }}>
                                        مدعوم من <strong>WBA</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
