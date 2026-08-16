import { useState, useMemo } from 'react'
import {
    Palette, MessageSquare, Settings, Layout, Monitor, Smartphone, Tablet,
    RotateCcw, Check, Copy, X, Sparkles, Bot, Code, ShoppingCart, GraduationCap,
    Utensils, Building2, Globe, Zap, BarChart3, Clock, MessageCircle,
    ThumbsUp, ChevronLeft, ChevronRight, Eye, Volume2, Timer, Maximize2,
    Hash, Terminal,
} from 'lucide-react'
import { PRESET_COLORS, WIDGET_POSITIONS, DEFAULT_WIDGET_PUBLIC } from '@wba/widget-config'
import { EMBED_PLATFORMS, getEmbedSnippet } from '@wba/dashboard-ui/embedIntegrations'
import { urls } from '../lib/urls'
import ChatWidget from '../components/ChatWidget'

const presetColors = PRESET_COLORS
const positions = WIDGET_POSITIONS

/* ─── Scenarios ─── */
const scenarios = [
    {
        id: 'ecommerce', label: 'متجر إلكتروني', icon: ShoppingCart,
        color: '#f59e0b',
        siteName: 'TechStore',
        siteUrl: 'techstore.sa',
        botName: 'مساعد المتجر',
        botSubtitle: 'متصل الآن',
        welcome: 'مرحباً! 👋 أهلاً بك في TechStore. كيف أساعدك؟',
        suggestions: ['أين طلبي؟', 'سياسة الاسترجاع', 'عروض اليوم'],
        pageContent: {
            nav: ['الرئيسية', 'المنتجات', 'العروض', 'تواصل'],
            hero: 'خصم ٣٠٪ على الإلكترونيات',
            sub: 'أحدث الأجهزة بأفضل الأسعار — توصيل مجاني فوق ٢٠٠ ريال',
            cards: [
                { emoji: '📱', name: 'iPhone 16 Pro', price: '٤,٤٩٩ ر.س' },
                { emoji: '💻', name: 'MacBook Air M4', price: '٤,٩٩٩ ر.س' },
                { emoji: '🎧', name: 'AirPods Max', price: '٢,١٩٩ ر.س' },
            ],
        },
    },
    {
        id: 'saas', label: 'منصة SaaS', icon: Building2,
        color: '#006c35',
        siteName: 'CloudFlow',
        siteUrl: 'cloudflow.io',
        botName: 'مساعد CloudFlow',
        botSubtitle: 'دعم ٢٤/٧',
        welcome: 'مرحباً! 👋 كيف أقدر أساعدك مع CloudFlow؟',
        suggestions: ['كيف أربط الـ API؟', 'ما الباقات المتاحة؟', 'مشكلة في تسجيل الدخول'],
        pageContent: {
            nav: ['المنتج', 'التوثيق', 'الأسعار', 'الدعم'],
            hero: 'أتمت سير العمل بسهولة',
            sub: 'منصة سحابية متكاملة لإدارة المشاريع والفرق',
            cards: [
                { emoji: '⚡', name: 'أتمتة ذكية', price: 'أكثر من ١٠٠ قالب' },
                { emoji: '📊', name: 'تحليلات متقدمة', price: 'لحظة بلحظة' },
                { emoji: '🔗', name: 'تكاملات', price: '+٥٠ تطبيق' },
            ],
        },
    },
    {
        id: 'restaurant', label: 'مطعم', icon: Utensils,
        color: '#ef4444',
        siteName: 'مطعم الديرة',
        siteUrl: 'aldeera.sa',
        botName: 'مساعد المطعم',
        botSubtitle: 'اطلب الآن',
        welcome: 'أهلاً وسهلاً! 🍽️ كيف أساعدك؟',
        suggestions: ['القائمة', 'حجز طاولة', 'ساعات العمل'],
        pageContent: {
            nav: ['القائمة', 'الحجوزات', 'المناسبات', 'عنا'],
            hero: 'أطباق عربية أصيلة',
            sub: 'تجربة طعام فاخرة بنكهات تراثية في قلب الرياض',
            cards: [
                { emoji: '🥘', name: 'كبسة لحم', price: '٨٥ ر.س' },
                { emoji: '🍖', name: 'مشاوي مشكلة', price: '١٢٠ ر.س' },
                { emoji: '🍮', name: 'كنافة نابلسية', price: '٣٥ ر.س' },
            ],
        },
    },
    {
        id: 'education', label: 'منصة تعليمية', icon: GraduationCap,
        color: '#22c55e',
        siteName: 'منصة نور',
        siteUrl: 'noor.edu.sa',
        botName: 'مساعد نور',
        botSubtitle: 'تعلّم معنا',
        welcome: 'مرحباً! 📚 كيف أساعدك في رحلتك التعليمية؟',
        suggestions: ['الدورات المتاحة', 'كيف أحصل على الشهادة؟', 'خصومات الطلاب'],
        pageContent: {
            nav: ['الدورات', 'المسارات', 'المعلمون', 'الأسعار'],
            hero: 'تعلّم مهارات المستقبل',
            sub: '+٢٠٠ دورة احترافية في البرمجة والتصميم والتسويق',
            cards: [
                { emoji: '💻', name: 'تطوير الويب', price: '٣٢ درس' },
                { emoji: '🎨', name: 'تصميم UI/UX', price: '٢٤ درس' },
                { emoji: '📈', name: 'التسويق الرقمي', price: '٢٨ درس' },
            ],
        },
    },
]

const DEMO_API_BASE = urls.api

const embedOptions = EMBED_PLATFORMS.filter((p) =>
    ['salla', 'zid', 'custom-html', 'wordpress', 'shopify', 'react', 'nextjs'].includes(p.id)
).map((p) => ({
    id: p.id,
    label: p.label,
    getSnippet: () => getEmbedSnippet({ platformId: p.id, baseUrl: DEMO_API_BASE }),
}))

/* ─── Defaults ─── */
const defaults = {
    ...DEFAULT_WIDGET_PUBLIC,
    botSubtitle: 'مدعوم من WBA',
    suggestedQuestions: ['ما هي WBA؟', 'كيف أبدأ؟', 'كم الأسعار؟'],
    avatarStyle: 'sparkle',
    autoOpenDelay: 3,
}

export default function Demo() {
    const [cfg, setCfg] = useState({ ...defaults })
    const [tab, setTab] = useState('scenario')
    const [device, setDevice] = useState('desktop')
    const [copied, setCopied] = useState(false)
    const [chatKey, setChatKey] = useState(0)
    const [scenario, setScenario] = useState('ecommerce')
    const [embedTab, setEmbedTab] = useState('salla')
    const [liveStats, setLiveStats] = useState({ messages: 0, responseTime: 0, satisfaction: 0 })
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    const activeScenario = scenarios.find(s => s.id === scenario)
    const set = (k, v) => setCfg(prev => ({ ...prev, [k]: v }))
    const reset = () => { setCfg({ ...defaults }); setChatKey(prev => prev + 1); setScenario('ecommerce') }

    const applyScenario = (s) => {
        setScenario(s.id)
        setCfg(prev => ({
            ...prev,
            color: s.color,
            botName: s.botName,
            botSubtitle: s.botSubtitle,
            welcomeMessage: s.welcome,
            suggestedQuestions: s.suggestions,
        }))
        setChatKey(prev => prev + 1)
    }

    const copyCode = () => {
        const opt = embedOptions.find(e => e.id === embedTab)
        navigator.clipboard.writeText(opt.getSnippet().code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const tabItems = [
        { id: 'scenario', label: 'السيناريو', icon: Globe },
        { id: 'appearance', label: 'المظهر', icon: Palette },
        { id: 'messages', label: 'الرسائل', icon: MessageSquare },
        { id: 'behavior', label: 'السلوك', icon: Settings },
        { id: 'embed', label: 'التضمين', icon: Code },
    ]

    const deviceSizes = {
        desktop: { w: 820, h: 580, label: 'كمبيوتر' },
        tablet: { w: 580, h: 700, label: 'تابلت' },
        mobile: { w: 375, h: 700, label: 'جوال' },
    }

    const isDark = cfg.theme === 'dark'
    const pc = activeScenario?.pageContent

    return (
        <div className={`demo-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} id="demo-page">
            {/* ─── Sidebar Controls ─── */}
            <div className="demo-sidebar">
                <div className="demo-sidebar-head">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                                تجربة مباشرة
                            </h2>
                            <p>خصّص البوت وشاهد التغييرات فوراً — اختر سيناريو وعدّل كل التفاصيل</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button className="btn btn-secondary btn-sm" onClick={reset} style={{ flex: 1 }}>
                            <RotateCcw size={13} /> إعادة تعيين
                        </button>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                            <Check size={13} /> حفظ الإعدادات
                        </button>
                    </div>
                </div>

                {/* ─── Live Stats Bar ─── */}
                <div className="demo-stats-bar">
                    <div className="demo-stat-pill">
                        <MessageCircle size={12} />
                        <span>{liveStats.messages}</span>
                        <small>محادثة</small>
                    </div>
                    <div className="demo-stat-pill">
                        <Clock size={12} />
                        <span>{liveStats.responseTime || '—'}ms</span>
                        <small>استجابة</small>
                    </div>
                    <div className="demo-stat-pill">
                        <ThumbsUp size={12} />
                        <span>{liveStats.satisfaction || '—'}%</span>
                        <small>رضا</small>
                    </div>
                </div>

                {/* Tabs */}
                <div className="demo-tabs-row">
                    {tabItems.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`demo-tab ${tab === t.id ? 'active' : ''}`}
                        >
                            <t.icon size={12} />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="demo-tab-content">

                    {/* ═══ SCENARIO TAB ═══ */}
                    {tab === 'scenario' && (
                        <>
                            <div className="demo-section">
                                <div className="demo-section-title">اختر نوع الموقع</div>
                                <p style={{ fontSize: 11.5, color: 'var(--text-4)', marginBottom: 14, marginTop: -8 }}>
                                    اختر سيناريو والبوت سيتكيف تلقائياً مع نوع الموقع
                                </p>
                                <div className="scenario-grid">
                                    {scenarios.map(s => (
                                        <button
                                            key={s.id}
                                            className={`scenario-card ${scenario === s.id ? 'active' : ''}`}
                                            onClick={() => applyScenario(s)}
                                            style={{
                                                '--scenario-color': s.color,
                                                borderColor: scenario === s.id ? s.color : undefined,
                                            }}
                                        >
                                            <div className="scenario-icon" style={{
                                                background: `${s.color}15`,
                                                color: s.color,
                                            }}>
                                                <s.icon size={18} />
                                            </div>
                                            <div className="scenario-info">
                                                <strong>{s.label}</strong>
                                                <small>{s.siteName}</small>
                                            </div>
                                            {scenario === s.id && (
                                                <div className="scenario-check" style={{ background: s.color }}>
                                                    <Check size={10} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">ماذا يتغير؟</div>
                                <div className="scenario-changes">
                                    <div className="scenario-change-item">
                                        <Palette size={13} style={{ color: 'var(--accent)' }} />
                                        <span>اللون الأساسي يتغير حسب نوع الموقع</span>
                                    </div>
                                    <div className="scenario-change-item">
                                        <MessageSquare size={13} style={{ color: '#006c35' }} />
                                        <span>رسائل البوت تتكيف مع سياق الموقع</span>
                                    </div>
                                    <div className="scenario-change-item">
                                        <Zap size={13} style={{ color: '#0a8244' }} />
                                        <span>الأسئلة المقترحة مخصصة للسيناريو</span>
                                    </div>
                                    <div className="scenario-change-item">
                                        <Eye size={13} style={{ color: '#004d26' }} />
                                        <span>معاينة الموقع الوهمي تتغير</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ APPEARANCE TAB ═══ */}
                    {tab === 'appearance' && (
                        <>
                            <div className="demo-section">
                                <div className="demo-section-title">اللون الأساسي</div>
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
                                    <input
                                        className="input"
                                        value={cfg.color}
                                        onChange={e => set('color', e.target.value)}
                                        style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, direction: 'ltr', textAlign: 'left' }}
                                    />
                                    <input
                                        type="color"
                                        value={cfg.color}
                                        onChange={e => set('color', e.target.value)}
                                        style={{ width: 36, height: 36, border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer', padding: 0 }}
                                    />
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">السمة</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {['dark', 'light'].map(t => (
                                        <button key={t} onClick={() => { set('theme', t); setChatKey(prev => prev + 1) }} className={`theme-option ${cfg.theme === t ? 'active' : ''}`}>
                                            <div className="theme-preview" style={{ background: t === 'dark' ? '#1a1a2e' : '#f8f9fa' }}>
                                                <div style={{ width: '60%', height: 4, background: t === 'dark' ? '#333' : '#ddd', borderRadius: 2 }} />
                                                <div style={{ width: '40%', height: 4, background: t === 'dark' ? '#2a2a45' : '#e5e5e5', borderRadius: 2 }} />
                                                <div style={{ width: '80%', height: 3, background: t === 'dark' ? '#222' : '#eee', borderRadius: 2 }} />
                                            </div>
                                            <span style={{ color: t === 'dark' ? '#fff' : '#333' }}>{t === 'dark' ? '🌙 داكن' : '☀️ فاتح'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">حدة الزوايا</div>
                                <div className="radius-control">
                                    <div className="radius-preview" style={{ borderRadius: cfg.radius, borderColor: cfg.color }} />
                                    <div style={{ flex: 1 }}>
                                        <input
                                            type="range" min={0} max={24} value={cfg.radius}
                                            onChange={e => set('radius', +e.target.value)}
                                            style={{ width: '100%', accentColor: cfg.color }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                                            <span>مربع</span>
                                            <span style={{ fontFamily: 'var(--mono)' }}>{cfg.radius}px</span>
                                            <span>دائري</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">شكل الأيقونة</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[
                                        { id: 'sparkle', icon: <Sparkles size={16} />, label: 'نجمة' },
                                        { id: 'bot', icon: <Bot size={16} />, label: 'بوت' },
                                        { id: 'circle', icon: <span style={{ fontSize: 14 }}>●</span>, label: 'دائرة' },
                                    ].map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => set('avatarStyle', a.id)}
                                            className={`avatar-option ${cfg.avatarStyle === a.id ? 'active' : ''}`}
                                            style={{ '--opt-color': cfg.color }}
                                        >
                                            <div className="avatar-option-icon" style={{
                                                background: cfg.avatarStyle === a.id ? cfg.color : 'var(--bg-4)',
                                                color: cfg.avatarStyle === a.id ? '#fff' : 'var(--text-3)',
                                            }}>
                                                {a.icon}
                                            </div>
                                            <small>{a.label}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-toggle-row">
                                    <div>
                                        <div className="demo-section-title" style={{ marginBottom: 2 }}>شعار WBA</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>إظهار "مدعوم من WBA"</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={cfg.showBranding} onChange={e => set('showBranding', e.target.checked)} />
                                        <span className="toggle-track" />
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ MESSAGES TAB ═══ */}
                    {tab === 'messages' && (
                        <>
                            <div className="demo-section">
                                <div className="field">
                                    <label className="field-label">اسم البوت</label>
                                    <input
                                        className="input"
                                        value={cfg.botName}
                                        onChange={e => { set('botName', e.target.value); setChatKey(prev => prev + 1) }}
                                    />
                                </div>
                                <div className="field">
                                    <label className="field-label">العنوان الفرعي</label>
                                    <input
                                        className="input"
                                        value={cfg.botSubtitle}
                                        onChange={e => { set('botSubtitle', e.target.value); setChatKey(prev => prev + 1) }}
                                    />
                                </div>
                                <div className="field">
                                    <label className="field-label">رسالة الترحيب</label>
                                    <textarea
                                        className="input"
                                        value={cfg.welcomeMessage}
                                        onChange={e => { set('welcomeMessage', e.target.value); setChatKey(prev => prev + 1) }}
                                        rows={3}
                                    />
                                </div>
                                <div className="field">
                                    <label className="field-label">نص مربع الإدخال</label>
                                    <input
                                        className="input"
                                        value={cfg.placeholder}
                                        onChange={e => set('placeholder', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">أسئلة مقترحة</div>
                                <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 10, marginTop: -8 }}>
                                    تظهر للزائر عند فتح المحادثة لأول مرة
                                </p>
                                {cfg.suggestedQuestions.map((q, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                                        <span style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--bg-4)', display: 'inline-grid', placeItems: 'center', fontSize: 10, color: 'var(--text-4)', flexShrink: 0 }}>{i + 1}</span>
                                        <input
                                            className="input"
                                            value={q}
                                            onChange={e => {
                                                const arr = [...cfg.suggestedQuestions]; arr[i] = e.target.value
                                                set('suggestedQuestions', arr)
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            onClick={() => { set('suggestedQuestions', cfg.suggestedQuestions.filter((_, j) => j !== i)); setChatKey(prev => prev + 1) }}
                                            style={{ color: 'var(--red)', width: 28, height: 28, display: 'inline-grid', placeItems: 'center', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))}
                                {cfg.suggestedQuestions.length < 5 && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => { set('suggestedQuestions', [...cfg.suggestedQuestions, '']); setChatKey(prev => prev + 1) }}
                                        style={{ marginTop: 4, width: '100%' }}
                                    >
                                        + إضافة سؤال
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* ═══ BEHAVIOR TAB ═══ */}
                    {tab === 'behavior' && (
                        <>
                            <div className="demo-section">
                                <div className="field">
                                    <label className="field-label">نموذج الذكاء الاصطناعي</label>
                                    <select className="input">
                                        <option value="gpt-4o">GPT-4o (متقدم — أعلى دقة)</option>
                                        <option value="gpt-4o-mini">GPT-4o Mini (سريع — تكلفة أقل)</option>
                                        <option value="claude-3.5">Claude 3.5 Sonnet (نصوص طويلة)</option>
                                        <option value="gemini-pro">Gemini Pro (فهم متعدد)</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="field-label">لغة الرد</label>
                                    <select className="input">
                                        <option value="auto">تلقائي (يتعرف على لغة الزائر)</option>
                                        <option value="ar">العربية دائماً</option>
                                        <option value="en">English Only</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="field-label">الحد الأقصى للردود بالمحادثة</label>
                                    <input type="number" className="input" defaultValue={20} min={5} max={100} style={{ direction: 'ltr', textAlign: 'left' }} />
                                </div>
                                <div className="field">
                                    <label className="field-label">درجة الإبداع (Temperature)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>🎯 دقيق</span>
                                        <input type="range" min={0} max={100} defaultValue={30} style={{ flex: 1, accentColor: cfg.color }} />
                                        <span style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>🎨 إبداعي</span>
                                    </div>
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">سلوك إضافي</div>

                                <div className="demo-toggle-row" style={{ marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>فتح تلقائي</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>فتح البوت تلقائياً بعد فترة محددة</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={cfg.autoOpen} onChange={e => set('autoOpen', e.target.checked)} />
                                        <span className="toggle-track" />
                                    </label>
                                </div>

                                {cfg.autoOpen && (
                                    <div className="field" style={{ marginBottom: 14 }}>
                                        <label className="field-label">تأخير الفتح التلقائي (ثانية)</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {[2, 3, 5, 10].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => set('autoOpenDelay', v)}
                                                    style={{
                                                        flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)',
                                                        border: `1.5px solid ${cfg.autoOpenDelay === v ? cfg.color : 'var(--border-2)'}`,
                                                        background: cfg.autoOpenDelay === v ? `${cfg.color}15` : 'var(--bg-3)',
                                                        color: cfg.autoOpenDelay === v ? cfg.color : 'var(--text-3)',
                                                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                                        transition: 'all 150ms',
                                                    }}
                                                >
                                                    {v}s
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="demo-toggle-row">
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>صوت الإشعار</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>تشغيل صوت عند وصول رد جديد</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={cfg.soundEnabled} onChange={e => set('soundEnabled', e.target.checked)} />
                                        <span className="toggle-track" />
                                    </label>
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-info-box">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>ملاحظة</span>
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
                                        هذه تجربة حية باستجابات مبرمجة مسبقاً تتكيف مع السيناريو المختار. في الإصدار الفعلي، سيستخدم البوت نموذج الذكاء الاصطناعي المحدد مع قاعدة المعرفة الخاصة بموقعك.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ EMBED TAB ═══ */}
                    {tab === 'embed' && (
                        <>
                            <div className="demo-section">
                                <div className="demo-section-title">موضع الويدجت</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {positions.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => set('position', p.id)}
                                            className={`position-option ${cfg.position === p.id ? 'active' : ''}`}
                                        >
                                            <div className="position-preview">
                                                <div className="position-dot" style={{
                                                    background: cfg.color,
                                                    ...(p.id.includes('bottom') ? { bottom: 3 } : { top: 3 }),
                                                    ...(p.id.includes('left') ? { left: 3 } : { right: 3 }),
                                                }} />
                                            </div>
                                            <span>{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="demo-section">
                                <div className="demo-section-title">كود التضمين حسب المنصة</div>
                                <div className="embed-tabs">
                                    {embedOptions.map(o => (
                                        <button
                                            key={o.id}
                                            onClick={() => setEmbedTab(o.id)}
                                            className={`embed-tab ${embedTab === o.id ? 'active' : ''}`}
                                        >
                                            {o.label}
                                        </button>
                                    ))}
                                </div>

                                {(() => {
                                    const snippet = embedOptions.find(e => e.id === embedTab)?.getSnippet()
                                    if (!snippet) return null
                                    return (
                                        <>
                                            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, margin: '10px 0 12px' }}>
                                                {snippet.summary}
                                            </p>
                                            <ol style={{ margin: '0 0 12px', paddingInlineStart: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.75 }}>
                                                {(snippet.steps || []).map((s, i) => (
                                                    <li key={i}>
                                                        <strong>{s.title}</strong>
                                                        {s.detail ? ` — ${s.detail}` : ''}
                                                    </li>
                                                ))}
                                            </ol>
                                            <div className="embed-code-block">
                                                <code>{snippet.code}</code>
                                            </div>
                                        </>
                                    )
                                })()}
                                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={copyCode}>
                                    {copied ? <><Check size={13} /> تم النسخ!</> : <><Copy size={13} /> نسخ الكود</>}
                                </button>
                            </div>

                            {embedOptions.find(e => e.id === embedTab)?.getSnippet()?.warning && (
                            <div className="demo-section">
                                <div className="demo-info-box" style={{ borderColor: `${cfg.color}30` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <Terminal size={14} style={{ color: cfg.color }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>ملاحظة مهمة</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65 }}>
                                        {embedOptions.find(e => e.id === embedTab)?.getSnippet()?.warning}
                                    </div>
                                </div>
                            </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ─── Preview Area ─── */}
            <div className="demo-preview-area">
                {/* Device Toggle + Collapse */}
                <div className="demo-preview-toolbar">
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="toolbar-btn"
                        title={sidebarCollapsed ? 'إظهار اللوحة' : 'إخفاء اللوحة'}
                    >
                        {sidebarCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <div className="device-toggle">
                        {[
                            { id: 'desktop', icon: Monitor },
                            { id: 'tablet', icon: Tablet },
                            { id: 'mobile', icon: Smartphone },
                        ].map(d => (
                            <button
                                key={d.id}
                                onClick={() => setDevice(d.id)}
                                className={`device-btn ${device === d.id ? 'active' : ''}`}
                                title={deviceSizes[d.id].label}
                            >
                                <d.icon size={14} />
                            </button>
                        ))}
                    </div>

                    <div className="toolbar-info">
                        <span>{deviceSizes[device].w} × {deviceSizes[device].h}</span>
                    </div>
                </div>

                {/* Browser Frame */}
                <div className="browser-frame" style={{
                    width: deviceSizes[device].w,
                    height: deviceSizes[device].h,
                }}>
                    {/* Browser bar */}
                    <div className="browser-bar" style={{ background: isDark ? '#1a1a2e' : '#e8e8e8' }}>
                        <div className="browser-dots">
                            <span style={{ background: '#ff5f57' }} />
                            <span style={{ background: '#ffbd2e' }} />
                            <span style={{ background: '#28c840' }} />
                        </div>
                        <div className="browser-url" style={{
                            background: isDark ? '#252542' : '#fff',
                            color: isDark ? '#666' : '#999',
                        }}>
                            <span style={{ color: '#0a8244', marginLeft: 4, fontSize: 9 }}>🔒</span>
                            {activeScenario?.siteUrl || 'your-website.com'}
                        </div>
                    </div>

                    {/* Simulated Website Content */}
                    <div className="sim-page" style={{
                        background: isDark ? '#0d0d1a' : '#fafafa',
                        color: isDark ? '#e0e0e0' : '#333',
                    }}>
                        {/* Simulated Nav */}
                        <div className="sim-nav" style={{ background: isDark ? '#141428' : '#fff', borderColor: isDark ? '#1f1f3a' : '#eee' }}>
                            <strong style={{ color: cfg.color, fontSize: device === 'mobile' ? 11 : 13 }}>{activeScenario?.siteName}</strong>
                            {device !== 'mobile' && pc?.nav && (
                                <div className="sim-nav-links">
                                    {pc.nav.map((n, i) => (
                                        <span key={i} style={{ color: isDark ? '#888' : '#666', fontSize: 10.5 }}>{n}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Simulated Hero */}
                        <div className="sim-hero">
                            <div className="sim-hero-badge" style={{ background: `${cfg.color}15`, color: cfg.color }}>
                                {activeScenario?.label || 'موقعك'}
                            </div>
                            <h2 className="sim-hero-title" style={{ fontSize: device === 'mobile' ? 16 : 20, color: isDark ? '#fff' : '#111' }}>
                                {pc?.hero || 'عنوان موقعك'}
                            </h2>
                            <p className="sim-hero-sub" style={{ fontSize: device === 'mobile' ? 10 : 11.5, color: isDark ? '#888' : '#777' }}>
                                {pc?.sub || 'وصف قصير عن موقعك ومنتجاتك'}
                            </p>
                            <button className="sim-cta-btn" style={{ background: cfg.color, fontSize: device === 'mobile' ? 10 : 11 }}>
                                ابدأ الآن
                            </button>
                        </div>

                        {/* Simulated Cards */}
                        {pc?.cards && (
                            <div className="sim-cards" style={{ gridTemplateColumns: device === 'mobile' ? '1fr' : `repeat(${Math.min(pc.cards.length, 3)}, 1fr)` }}>
                                {pc.cards.map((card, i) => (
                                    <div key={i} className="sim-card" style={{
                                        background: isDark ? '#181830' : '#fff',
                                        borderColor: isDark ? '#252545' : '#eee',
                                    }}>
                                        <span style={{ fontSize: device === 'mobile' ? 20 : 24 }}>{card.emoji}</span>
                                        <div style={{ fontSize: device === 'mobile' ? 10 : 11, fontWeight: 600, color: isDark ? '#ccc' : '#333' }}>{card.name}</div>
                                        <div style={{ fontSize: device === 'mobile' ? 9 : 10, color: cfg.color, fontWeight: 700 }}>{card.price}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Chat Widget Preview */}
                        <div className="sim-chat-container" style={{
                            width: device === 'mobile' ? 'calc(100% - 16px)' : Math.min(360, deviceSizes[device].w * 0.45),
                            height: device === 'mobile' ? 'calc(100% - 48px)' : Math.min(500, deviceSizes[device].h - 90),
                            ...(cfg.position.includes('bottom') ? { bottom: 8 } : { top: 46 }),
                            ...(cfg.position.includes('left') ? { left: 8 } : { right: 8 }),
                        }}>
                            <ChatWidget
                                key={chatKey}
                                color={cfg.color}
                                theme={cfg.theme}
                                botName={cfg.botName}
                                botSubtitle={cfg.botSubtitle}
                                welcomeMessage={cfg.welcomeMessage}
                                placeholder={cfg.placeholder}
                                suggestions={cfg.suggestedQuestions.filter(Boolean)}
                                showBranding={cfg.showBranding}
                                radius={cfg.radius}
                                scenario={scenario}
                                onStats={setLiveStats}
                                avatarStyle={cfg.avatarStyle}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
