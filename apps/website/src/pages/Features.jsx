import { Link } from 'react-router-dom'
import {
    BrainCircuit, Database, Palette, BarChart3, Shield, Code,
    Globe, Layers, Cpu, Zap, ArrowLeft, Check, Bot, FileText,
    MessageSquare, Settings, Eye, Lock, Users, RefreshCw,
    Terminal, Gauge, Webhook, Workflow
} from 'lucide-react'

const featureGroups = [
    {
        id: 'ai',
        title: 'الذكاء الاصطناعي',
        desc: 'محرك ذكاء اصطناعي متقدم يفهم سياق موقعك',
        icon: <BrainCircuit size={20} />,
        color: '#006c35',
        bg: 'rgba(0,108,53,0.1)',
        features: [
            { icon: <BrainCircuit size={18} />, title: 'نماذج متعددة', desc: 'اختر من GPT-4o, Claude 3.5, Gemini Pro, أو نموذجك الخاص للمؤسسات.' },
            { icon: <Globe size={18} />, title: 'فهم متعدد اللغات', desc: 'يتعرف تلقائياً على لغة الزائر ويرد بنفس اللغة، مع دعم لأكثر من ٣٠ لغة.' },
            { icon: <Gauge size={18} />, title: 'استجابة فائقة السرعة', desc: 'متوسط ٢٤٥ms فقط بفضل البنية التحتية المحسّنة وتقنيات التخزين المؤقت.' },
            { icon: <Settings size={18} />, title: 'ضبط السلوك', desc: 'تحكّم في درجة الإبداع، الحد الأقصى للردود، وأسلوب التواصل بالكامل.' },
        ],
    },
    {
        id: 'kb',
        title: 'قاعدة المعرفة',
        desc: 'فهرسة ذكية تلقائية لمحتوى موقعك',
        icon: <Database size={20} />,
        color: '#0a8244',
        bg: 'rgba(10,130,68,0.1)',
        features: [
            { icon: <Database size={18} />, title: 'فهرسة تلقائية RAG', desc: 'نزحف موقعك ونفهرس المحتوى باستخدام تقنية Retrieval-Augmented Generation.' },
            { icon: <FileText size={18} />, title: 'مصادر متعددة', desc: 'ادعم PDF, HTML, Markdown, FAQ وأكثر. رفع يدوي أو فهرسة تلقائية.' },
            { icon: <RefreshCw size={18} />, title: 'تحديث تلقائي', desc: 'زحف مجدول (كل ساعة، يومي، أسبوعي) لضمان أن البوت دائماً محدّث.' },
            { icon: <Eye size={18} />, title: 'تتبع الدقة', desc: 'مقياس دقة لكل وثيقة يساعدك في تحسين جودة الإجابات باستمرار.' },
        ],
    },
    {
        id: 'customize',
        title: 'التخصيص',
        desc: 'اجعل البوت يعكس هوية علامتك التجارية',
        icon: <Palette size={20} />,
        color: '#004d26',
        bg: 'rgba(0,77,38,0.1)',
        features: [
            { icon: <Palette size={18} />, title: 'ألوان وسمات', desc: 'اختر من ألوان محددة مسبقاً أو أدخل لونك الخاص. ادعم الوضع الداكن والفاتح.' },
            { icon: <MessageSquare size={18} />, title: 'رسائل مخصصة', desc: 'خصّص اسم البوت، رسالة الترحيب، نص الإدخال، والأسئلة المقترحة.' },
            { icon: <Layers size={18} />, title: 'تموضع مرن', desc: 'ضع الويدجت في أي زاوية من الصفحة مع التحكم في الحجم والشكل.' },
            { icon: <Bot size={18} />, title: 'معاينة مباشرة', desc: 'شاهد كل تغير في الوقت الفعلي على شاشة الكمبيوتر أو الجوال.' },
        ],
    },
    {
        id: 'analytics',
        title: 'التحليلات',
        desc: 'رؤى عميقة عن أداء مساعدك',
        icon: <BarChart3 size={20} />,
        color: '#1a9a52',
        bg: 'rgba(26,154,82,0.1)',
        features: [
            { icon: <BarChart3 size={18} />, title: 'لوحة تحكم شاملة', desc: 'عدد المحادثات، الاستعلامات، معدل الرد التلقائي، ومعدل الرضا في مكان واحد.' },
            { icon: <Users size={18} />, title: 'تحليل الزوار', desc: 'تعرّف على أهم أسئلة الزوار والصفحات الأكثر تفاعلاً والأوقات النشطة.' },
            { icon: <Cpu size={18} />, title: 'استهلاك الموارد', desc: 'تتبع استهلاك التوكنات، الاستعلامات، والتخزين مع تنبيهات استباقية.' },
            { icon: <Workflow size={18} />, title: 'تقارير مخصصة', desc: 'صدّر التقارير أو اضبط تنبيهات مخصصة بناءً على مقاييس محددة.' },
        ],
    },
    {
        id: 'security',
        title: 'الأمان',
        desc: 'حماية من الدرجة الأولى لبياناتك',
        icon: <Shield size={20} />,
        color: '#006c35',
        bg: 'rgba(0,108,53,0.1)',
        features: [
            { icon: <Lock size={18} />, title: 'تشفير كامل', desc: 'TLS لكل الاتصالات مع تشفير البيانات أثناء النقل والتخزين (AES-256).' },
            { icon: <Shield size={18} />, title: 'API Keys آمنة', desc: 'مفاتيح مشفرة بتجزئة SHA-256 مع نطاقات صلاحيات محددة لكل مفتاح.' },
            { icon: <Users size={18} />, title: 'إدارة الأدوار RBAC', desc: 'مالك، مدير، عضو — صلاحيات مخصصة لكل دور مع سجل تدقيق كامل.' },
            { icon: <Terminal size={18} />, title: 'تحديد المعدل', desc: 'حماية متعددة المستويات: عالمي، لكل مستأجر، لكل مفتاح، ولكل IP.' },
        ],
    },
    {
        id: 'integration',
        title: 'التكامل',
        desc: 'اتصال سلس مع أدواتك المفضلة',
        icon: <Code size={20} />,
        color: '#0a8244',
        bg: 'rgba(10,130,68,0.1)',
        features: [
            { icon: <Code size={18} />, title: 'سطر واحد', desc: 'أضف script tag واحد في HTML موقعك. لا تحتاج npm ولا بناء ولا إعدادات.' },
            { icon: <Terminal size={18} />, title: 'REST API كاملة', desc: 'API موثقة بالكامل للتحكم برمجياً في كل جانب من المنصة.' },
            { icon: <Webhook size={18} />, title: 'Webhooks', desc: 'استقبل أحداث المحادثات والتنبيهات في أنظمتك مباشرة عبر HTTP callbacks.' },
            { icon: <Layers size={18} />, title: 'SDK متعدد', desc: 'SDKs جاهزة لـ React, Vue, Angular, وأي framework — مع أمثلة كاملة.' },
        ],
    },
]

export default function Features() {
    return (
        <>
            {/* ═══ HERO ═══ */}
            <section className="section" id="features-hero" style={{ paddingTop: 'calc(var(--nav-h) + 60px)' }}>
                <div className="container text-center">
                    <div className="section-badge mx-auto">
                        <Zap size={13} />
                        <span>المميزات</span>
                    </div>
                    <h2 className="section-title" style={{ fontSize: 46 }}>
                        كل ما تحتاجه لبناء
                        <br />
                        <span className="gradient-text">مساعد ذكي احترافي</span>
                    </h2>
                    <p className="section-subtitle mx-auto">
                        تعرّف على جميع المميزات التي تجعل WBA الخيار الأمثل لأصحاب المواقع والشركات
                    </p>
                </div>
            </section>

            {/* ═══ FEATURE GROUPS ═══ */}
            {featureGroups.map((group, gi) => (
                <section
                    key={group.id}
                    className="section"
                    id={`feature-${group.id}`}
                    style={{ background: gi % 2 === 1 ? 'var(--bg-1)' : 'transparent', paddingTop: 60, paddingBottom: 60 }}
                >
                    <div className="container">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                background: group.bg, color: group.color,
                                display: 'grid', placeItems: 'center'
                            }}>
                                {group.icon}
                            </div>
                            <div>
                                <h3 style={{ fontSize: 22, fontWeight: 700 }}>{group.title}</h3>
                                <p style={{ fontSize: 13.5, color: 'var(--text-3)' }}>{group.desc}</p>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 16, marginTop: 28,
                        }}>
                            {group.features.map((f, fi) => (
                                <div key={fi} className="feature-card anim-in" style={{ padding: 24 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                                        background: group.bg, color: group.color,
                                        display: 'grid', placeItems: 'center', marginBottom: 16,
                                    }}>
                                        {f.icon}
                                    </div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.7 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}

            {/* ═══ CTA ═══ */}
            <div className="cta-section" id="features-cta">
                <h2>مستعد تجرّب <span className="gradient-text">بنفسك</span>؟</h2>
                <p>جرّب تخصيص البوت مباشرة وشوف كيف يشتغل على موقعك. البداية مجانية!</p>
                <div className="cta-actions">
                    <Link to="/demo" className="btn btn-primary btn-lg">
                        تجربة مباشرة
                        <ArrowLeft size={16} />
                    </Link>
                    <Link to="/pricing" className="btn btn-secondary btn-lg">
                        عرض الأسعار
                    </Link>
                </div>
            </div>
        </>
    )
}
