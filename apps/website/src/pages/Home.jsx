import { Link } from 'react-router-dom'
import {
    Bot, Zap, Shield, BarChart3, Globe, Palette, Cpu, FileText,
    ArrowLeft, Star, Check, MessageSquare, Sparkles, Send, Code,
    Database, BrainCircuit, Layers, Settings, Users
} from 'lucide-react'
import ChatWidget from '../components/ChatWidget'

export default function Home() {
    return (
        <>
            {/* ═══ HERO ═══ */}
            <section className="hero" id="hero-section">
                <div className="hero-bg">
                    <div className="hero-grid-lines" />
                </div>
                <div className="container">
                    <div className="hero-content">
                        <div className="section-badge">
                            <Sparkles size={13} />
                            <span>مساعد ذكي لمواقع الويب</span>
                        </div>
                        <h1 className="hero-title">
                            حوّل موقعك إلى تجربة
                            <br />
                            <span className="gradient-text">ذكية وتفاعلية</span>
                        </h1>
                        <p className="hero-desc">
                            أضف مساعد محادثة ذكي مدعوم بالذكاء الاصطناعي لموقعك في دقائق.
                            يفهم محتواك ويجيب على أسئلة زوارك ويرفع معدل التحويل ورضا العملاء.
                        </p>
                        <div className="hero-actions">
                            <Link to="/demo" className="btn btn-primary btn-lg">
                                جرّب مجاناً
                                <ArrowLeft size={16} />
                            </Link>
                            <Link to="/features" className="btn btn-secondary btn-lg">
                                استكشف المميزات
                            </Link>
                        </div>
                        <div className="hero-stats">
                            <div className="hero-stat">
                                <div className="hero-stat-val">+٥٠٠</div>
                                <div className="hero-stat-label">موقع نشط</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-val">٢M+</div>
                                <div className="hero-stat-label">محادثة شهرياً</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-val">٩٤٪</div>
                                <div className="hero-stat-label">معدل الرضا</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-val">٢٤٥ms</div>
                                <div className="hero-stat-label">متوسط الاستجابة</div>
                            </div>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="preview-frame">
                            <ChatWidget
                                color="#006c35"
                                theme="light"
                                botName="مساعد WBA"
                                botSubtitle="متصل الآن"
                                welcomeMessage="مرحباً! 👋 أنا مساعدك الذكي. اسألني أي شيء عن منصة WBA وسأساعدك فوراً."
                                placeholder="اسأل عن المميزات، الأسعار..."
                                suggestions={['ما هي WBA؟', 'كيف أبدأ؟', 'كم الأسعار؟']}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ BRAND STRIP ═══ */}
            <div className="brands-strip container" id="brands-strip">
                <span>Shopify</span>
                <span>WordPress</span>
                <span>Wix</span>
                <span>React</span>
                <span>Next.js</span>
                <span>Webflow</span>
                <span>Custom</span>
            </div>

            {/* ═══ FEATURES ═══ */}
            <section className="section" id="features-section">
                <div className="container text-center">
                    <div className="section-badge mx-auto">
                        <Zap size={13} />
                        <span>لماذا WBA؟</span>
                    </div>
                    <h2 className="section-title">
                        كل ما تحتاجه في <span className="gradient-text">منصة واحدة</span>
                    </h2>
                    <p className="section-subtitle mx-auto">
                        مجموعة متكاملة من الأدوات لإنشاء مساعد ذكي يفهم موقعك ويخدم زوارك على مدار الساعة
                    </p>

                    <div className="features-grid">
                        {[
                            { icon: <BrainCircuit size={22} />, color: '#006c35', bg: 'rgba(0,108,53,0.1)', title: 'ذكاء اصطناعي متقدم', desc: 'نستخدم أحدث نماذج GPT-4o و Claude 3.5 لفهم الأسئلة والرد بدقة عالية مع فهم السياق الكامل.' },
                            { icon: <Database size={22} />, color: '#0a8244', bg: 'rgba(10,130,68,0.1)', title: 'قاعدة معرفة ذكية', desc: 'فهرسة تلقائية لمحتوى موقعك باستخدام تقنية RAG المتقدمة. يفهم البوت كل صفحة ووثيقة.' },
                            { icon: <Palette size={22} />, color: '#004d26', bg: 'rgba(0,77,38,0.1)', title: 'تخصيص كامل', desc: 'غيّر الألوان، الشعار، الرسائل، والسلوك. اجعل البوت يتناسب تماماً مع هوية علامتك التجارية.' },
                            { icon: <BarChart3 size={22} />, color: '#1a9a52', bg: 'rgba(26,154,82,0.1)', title: 'تحليلات متقدمة', desc: 'لوحة تحكم شاملة مع إحصائيات المحادثات وأسئلة الزوار ومعدل الرضا والأداء في الوقت الفعلي.' },
                            { icon: <Shield size={22} />, color: '#006c35', bg: 'rgba(0,108,53,0.1)', title: 'أمان متقدم', desc: 'تشفير كامل، API keys آمنة، RBAC متعدد الأدوار، وامتثال تام لسياسات الخصوصية العالمية.' },
                            { icon: <Code size={22} />, color: '#0a8244', bg: 'rgba(10,130,68,0.1)', title: 'تكامل سهل', desc: 'سطر واحد من الكود لإضافة البوت. ندعم WordPress, Shopify, React, وأي موقع ويب.' },
                            { icon: <Globe size={22} />, color: '#168f4a', bg: 'rgba(22,143,74,0.1)', title: 'دعم متعدد اللغات', desc: 'البوت يفهم ويرد بالعربية والإنجليزية وأكثر من ٣٠ لغة تلقائياً بناءً على لغة الزائر.' },
                            { icon: <Layers size={22} />, color: '#004d26', bg: 'rgba(0,77,38,0.1)', title: 'لوحة بسيطة', desc: 'كل شيء لموقعك في مكان واحد: التعليم، التثبيت، الشكل، والمحادثات — بدون تعقيد.' },
                            { icon: <Cpu size={22} />, color: '#1a9a52', bg: 'rgba(26,154,82,0.1)', title: 'سرعة فائقة', desc: 'متوسط استجابة ٢٤٥ مللي ثانية فقط مع بنية تحتية سحابية موزعة عالمياً.' },
                        ].map((f, i) => (
                            <div key={i} className="feature-card anim-in">
                                <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
                                    {f.icon}
                                </div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ HOW IT WORKS ═══ */}
            <section className="section" id="how-it-works" style={{ background: 'var(--bg-1)' }}>
                <div className="container text-center">
                    <div className="section-badge mx-auto">
                        <Settings size={13} />
                        <span>كيف يعمل؟</span>
                    </div>
                    <h2 className="section-title">
                        ثلاث خطوات <span className="gradient-text">بسيطة</span>
                    </h2>
                    <p className="section-subtitle mx-auto">
                        من التسجيل إلى بوت ذكي يعمل على موقعك — في أقل من ٥ دقائق
                    </p>

                    <div className="steps-row">
                        <div className="step-card anim-in">
                            <div className="step-number" style={{ background: 'rgba(0,108,53,0.1)', color: '#006c35', border: '2px solid rgba(0,108,53,0.2)' }}>
                                ١
                            </div>
                            <h3>سجّل وأضف موقعك</h3>
                            <p>أنشئ حسابك المجاني، أضف رابط موقعك، وتحقق من الملكية بخطوة واحدة.</p>
                        </div>
                        <div className="step-card anim-in">
                            <div className="step-number" style={{ background: 'rgba(10,130,68,0.1)', color: '#0a8244', border: '2px solid rgba(10,130,68,0.2)' }}>
                                ٢
                            </div>
                            <h3>خصّص مساعدك</h3>
                            <p>اختر الألوان، نموذج الذكاء الاصطناعي، أسلوب الرد، والأسئلة المقترحة.</p>
                        </div>
                        <div className="step-card anim-in">
                            <div className="step-number" style={{ background: 'rgba(26,154,82,0.1)', color: '#1a9a52', border: '2px solid rgba(26,154,82,0.2)' }}>
                                ٣
                            </div>
                            <h3>أضف كود التضمين</h3>
                            <p>انسخ سطر واحد من الكود والصقه في موقعك — البوت جاهز للعمل!</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ INTEGRATIONS ═══ */}
            <section className="section" id="integrations-section">
                <div className="container text-center">
                    <div className="section-badge mx-auto">
                        <Layers size={13} />
                        <span>التكاملات</span>
                    </div>
                    <h2 className="section-title">
                        يعمل مع <span className="gradient-text">كل شيء</span>
                    </h2>
                    <p className="section-subtitle mx-auto">
                        تكامل سلس مع أشهر المنصات وأطر العمل — بدون إعدادات معقدة
                    </p>
                    <div className="integrations-categories">
                        {[
                            {
                                label: 'عام',
                                items: [
                                    { emoji: '🔧', name: 'HTML مخصص' },
                                ],
                            },
                            {
                                label: 'متاجر سعودية',
                                items: [
                                    { emoji: '🛍️', name: 'سلة' },
                                    { emoji: '🏬', name: 'زد' },
                                ],
                            },
                            {
                                label: 'متاجر إلكترونية',
                                items: [
                                    { emoji: '🛒', name: 'Shopify' },
                                ],
                            },
                            {
                                label: 'منصات المواقع',
                                items: [
                                    { emoji: '📝', name: 'WordPress' },
                                    { emoji: '🌐', name: 'Wix' },
                                    { emoji: '📦', name: 'Squarespace' },
                                    { emoji: '🎨', name: 'Webflow' },
                                ],
                            },
                            {
                                label: 'أطر العمل',
                                items: [
                                    { emoji: '⚛️', name: 'React' },
                                    { emoji: '▲', name: 'Next.js' },
                                    { emoji: '🔷', name: 'Vue.js' },
                                    { emoji: '🅰️', name: 'Angular' },
                                    { emoji: '💎', name: 'Ruby on Rails' },
                                    { emoji: '🐍', name: 'Django' },
                                ],
                            },
                        ].map((cat, ci) => (
                            <div key={ci} className="integ-category">
                                <div className="integ-category-label">{cat.label}</div>
                                <div className="integ-category-items">
                                    {cat.items.map((item, ii) => (
                                        <div key={ii} className="integ-item anim-in">
                                            <span>{item.emoji}</span>
                                            <small>{item.name}</small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ TESTIMONIALS ═══ */}
            <section className="section" id="testimonials-section" style={{ background: 'var(--bg-1)' }}>
                <div className="container text-center">
                    <div className="section-badge mx-auto">
                        <Users size={13} />
                        <span>آراء العملاء</span>
                    </div>
                    <h2 className="section-title">
                        يثق بنا <span className="gradient-text">المئات</span>
                    </h2>
                    <p className="section-subtitle mx-auto">
                        شركات من مختلف القطاعات تستخدم WBA لتقديم تجربة خدمة عملاء استثنائية
                    </p>

                    <div className="testimonials-row">
                        {[
                            {
                                text: 'WBA غيّرت تجربة عملائنا بالكامل. البوت يجيب على 90% من الأسئلة تلقائياً والعملاء مبهورين من سرعة الرد.',
                                name: 'أحمد الشمري',
                                role: 'مدير التقنية — TechCo',
                                color: '#006c35',
                            },
                            {
                                text: 'التكامل كان سهل جداً، سطر واحد وخلاص! الآن فريق الدعم يركز على المشاكل المعقدة بينما البوت يتعامل مع الباقي.',
                                name: 'سارة العتيبي',
                                role: 'مديرة المنتج — StartupX',
                                color: '#0a8244',
                            },
                            {
                                text: 'التحليلات اللي يوفرها WBA ساعدتنا نفهم احتياجات عملائنا بشكل أعمق. الآن نعرف بالضبط وش يسألون عنه.',
                                name: 'فهد القحطاني',
                                role: 'مؤسس — DataFlow',
                                color: '#1a9a52',
                            },
                        ].map((t, i) => (
                            <div key={i} className="testimonial-card anim-in">
                                <div className="testimonial-stars">
                                    {[...Array(5)].map((_, j) => <Star key={j} size={14} fill="currentColor" />)}
                                </div>
                                <p className="testimonial-text">"{t.text}"</p>
                                <div className="testimonial-author">
                                    <div className="testimonial-avatar" style={{ background: t.color }}>
                                        {t.name[0]}
                                    </div>
                                    <div className="testimonial-meta">
                                        <strong>{t.name}</strong>
                                        <span>{t.role}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA ═══ */}
            <div className="cta-section" id="cta-section">
                <h2>جاهز تبدأ <span className="gradient-text">رحلتك الذكية</span>؟</h2>
                <p>انضم لأكثر من ٥٠٠ موقع يستخدم WBA لتقديم تجربة مستخدم استثنائية. ابدأ مجاناً اليوم.</p>
                <div className="cta-actions">
                    <Link to="/signup" className="btn btn-primary btn-lg">
                        ابدأ مجاناً الآن
                        <ArrowLeft size={16} />
                    </Link>
                    <Link to="/features" className="btn btn-secondary btn-lg">
                        تعرّف على المميزات
                    </Link>
                </div>
            </div>
        </>
    )
}
