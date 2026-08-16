import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ArrowLeft, Sparkles, Zap, HelpCircle } from 'lucide-react'
import { getPricingPagePlans, toArabicNumerals } from '@wba/plans'

const plans = getPricingPagePlans()

const faqs = [
    {
        q: 'هل يمكنني تغيير الباقة في أي وقت؟',
        a: 'نعم، يمكنك الترقية أو تخفيض باقتك في أي لحظة. التغييرات تسري فوراً ويتم احتساب الفرق بشكل تناسبي.',
    },
    {
        q: 'ماذا يحدث إذا تجاوزت حد الاستعلامات؟',
        a: 'نرسل لك تنبيهات عند الوصول لـ ٧٥٪ و ٩٠٪. عند تجاوز الحد، يمكنك الترقية أو شراء حزمة إضافية. لن نوقف الخدمة فجأة.',
    },
    {
        q: 'هل أحتاج بطاقة ائتمان للباقة المجانية؟',
        a: 'لا، الباقة المجانية لا تتطلب أي معلومات دفع. يمكنك البدء فوراً بعد التسجيل.',
    },
    {
        q: 'ما الفرق بين النماذج المتاحة؟',
        a: 'GPT-4o Mini سريع وفعال من حيث التكلفة. GPT-4o أكثر دقة وذكاءً. Claude 3.5 ممتاز للنصوص الطويلة. Gemini Pro يتميز بالفهم المتعدد.',
    },
    {
        q: 'هل تقدمون خصومات للاشتراك السنوي؟',
        a: 'نعم! عند الاشتراك السنوي تحصل على خصم ٢٠٪ — أي توفير شهرين مجاناً.',
    },
]

export default function Pricing() {
    const [annual, setAnnual] = useState(false)
    const [openFaq, setOpenFaq] = useState(null)

    return (
        <>
            {/* ═══ HERO ═══ */}
            <section className="section" id="pricing-hero" style={{ paddingTop: 'calc(var(--nav-h) + 60px)', paddingBottom: 40 }}>
                <div className="container text-center">
                    <div className="section-badge mx-auto">
                        <Sparkles size={13} />
                        <span>الأسعار</span>
                    </div>
                    <h2 className="section-title" style={{ fontSize: 46 }}>
                        باقات تناسب
                        <br />
                        <span className="gradient-text">كل الاحتياجات</span>
                    </h2>
                    <p className="section-subtitle mx-auto">
                        ابدأ مجاناً وارتقِ مع نمو مشروعك. لا رسوم خفية ولا التزامات طويلة.
                    </p>

                    {/* Annual toggle */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 14,
                        marginTop: 32, padding: '6px 8px',
                        background: 'var(--bg-3)', borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-2)',
                    }}>
                        <button
                            onClick={() => setAnnual(false)}
                            style={{
                                padding: '8px 20px', borderRadius: 'var(--radius-full)',
                                fontSize: 13, fontWeight: 600,
                                background: !annual ? 'var(--accent)' : 'transparent',
                                color: !annual ? '#fff' : 'var(--text-3)',
                                transition: 'all 200ms',
                            }}
                        >
                            شهري
                        </button>
                        <button
                            onClick={() => setAnnual(true)}
                            style={{
                                padding: '8px 20px', borderRadius: 'var(--radius-full)',
                                fontSize: 13, fontWeight: 600,
                                background: annual ? 'var(--accent)' : 'transparent',
                                color: annual ? '#fff' : 'var(--text-3)',
                                transition: 'all 200ms',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}
                        >
                            سنوي
                            <span style={{
                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                background: 'rgba(52,211,153,0.15)', color: 'var(--green)',
                                fontSize: 10, fontWeight: 700,
                            }}>
                                وفّر ٢٠٪
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* ═══ PRICING CARDS ═══ */}
            <section className="section" id="pricing-cards" style={{ paddingTop: 20 }}>
                <div className="container">
                    <div className="pricing-grid">
                        {plans.map((plan) => {
                            const price = annual ? plan.annualPrice : plan.monthlyPrice
                            return (
                            <div key={plan.id} className={`pricing-card ${plan.popular ? 'popular' : ''} anim-in`}>
                                <div className="pricing-name">{plan.name}</div>
                                <div className="pricing-desc">{plan.desc}</div>
                                <div className="pricing-price">
                                    {plan.monthlyPrice === null ? (
                                        'مخصص'
                                    ) : plan.monthlyPrice === 0 ? (
                                        <>٠<small>{plan.period}</small></>
                                    ) : (
                                        <>
                                            {toArabicNumerals(price)}
                                            <small style={{ fontSize: 14, fontWeight: 500, marginRight: 4 }}>{plan.currency}</small>
                                            <small>{plan.period}</small>
                                        </>
                                    )}
                                </div>
                                {annual && plan.monthlyPrice > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8, textAlign: 'center' }}>
                                        بدلاً من {toArabicNumerals(plan.monthlyPrice)} {plan.currency}/شهر
                                    </div>
                                )}
                                <ul className="pricing-features">
                                    {plan.features.map((f, i) => (
                                        <li key={i}>
                                            <Check size={14} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                {plan.id === 'enterprise' ? (
                                    <a href="mailto:support@wba.ai" className="btn btn-secondary pricing-btn">
                                        {plan.cta}
                                    </a>
                                ) : (
                                    <Link
                                        to={`/signup${plan.id !== 'free' ? `?plan=${plan.id}&billing=${annual ? 'annual' : 'monthly'}` : ''}`}
                                        className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'} pricing-btn`}
                                    >
                                        {plan.cta}
                                    </Link>
                                )}
                            </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ FAQ ═══ */}
            <section className="section" id="pricing-faq" style={{ background: 'var(--bg-1)' }}>
                <div className="container" style={{ maxWidth: 700 }}>
                    <div className="text-center" style={{ marginBottom: 48 }}>
                        <div className="section-badge mx-auto">
                            <HelpCircle size={13} />
                            <span>أسئلة شائعة</span>
                        </div>
                        <h2 className="section-title" style={{ fontSize: 32 }}>
                            أسئلة <span className="gradient-text">متكررة</span>
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {faqs.map((faq, i) => (
                            <div
                                key={i}
                                style={{
                                    background: 'var(--bg-2)',
                                    border: '1px solid var(--border-1)',
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden',
                                    transition: 'all 200ms',
                                }}
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    style={{
                                        width: '100%', padding: '18px 22px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        fontSize: 14, fontWeight: 600, color: 'var(--text-1)',
                                        textAlign: 'right',
                                    }}
                                >
                                    <span>{faq.q}</span>
                                    <span style={{
                                        transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)',
                                        transition: 'transform 200ms',
                                        color: 'var(--text-4)',
                                    }}>
                                        <Zap size={16} />
                                    </span>
                                </button>
                                {openFaq === i && (
                                    <div style={{
                                        padding: '0 22px 18px',
                                        fontSize: 13.5, color: 'var(--text-3)',
                                        lineHeight: 1.8,
                                        animation: 'fadeInUp 200ms ease both',
                                    }}>
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA ═══ */}
            <div className="cta-section" id="pricing-cta">
                <h2>جاهز تبدأ <span className="gradient-text">اليوم</span>؟</h2>
                <p>لا تحتاج بطاقة ائتمان. ابدأ بالباقة المجانية وارتقِ مع نمو مشروعك.</p>
                <div className="cta-actions">
                    <Link to="/signup" className="btn btn-primary btn-lg">
                        ابدأ مجاناً
                        <ArrowLeft size={16} />
                    </Link>
                </div>
            </div>
        </>
    )
}
