import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js'
import {
    ArrowRight,
    Shield,
    Lock,
    CheckCircle2,
    CreditCard,
    Loader2,
    AlertCircle,
    Check,
    Sparkles,
} from 'lucide-react'
import { PLAN_CATALOG } from '@wba/plans'

const PLANS = Object.fromEntries(
    PLAN_CATALOG.filter((p) => p.id === 'starter' || p.id === 'pro').map((p) => [
        p.id,
        {
            name: p.name,
            desc: p.desc,
            monthlyPrice: p.monthlyPrice,
            annualPrice: p.annualPrice,
            features: p.features,
            color: p.color?.startsWith('var(') ? 'var(--accent)' : p.color,
            popular: p.popular,
        },
    ])
)

function toArabicNumerals(n) {
    return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
}

// ─── Stripe element appearance ────────────────────────────────────────────────
const ELEMENT_STYLE = {
    style: {
        base: {
            fontSize: '15px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#f1f5f9',
            '::placeholder': { color: '#475569' },
            iconColor: '#006c35',
        },
        invalid: { color: '#f87171', iconColor: '#f87171' },
    },
}

// ─── inner checkout form ───────────────────────────────────────────────────────
function CheckoutForm({ plan, billing, price }) {
    const stripe = useStripe()
    const elements = useElements()
    const navigate = useNavigate()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const [cardErrors, setCardErrors] = useState({ number: null, expiry: null, cvc: null })

    const annual = billing === 'annual'
    const totalMonthly = annual ? price * 12 : price

    function handleCardChange(field) {
        return (e) => setCardErrors(prev => ({ ...prev, [field]: e.error?.message || null }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!stripe || !elements) return

        setError(null)
        setLoading(true)

        const cardNumber = elements.getElement(CardNumberElement)

        try {
            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardNumber,
                billing_details: { name, email },
            })

            if (pmError) {
                setError(pmError.message)
                setLoading(false)
                return
            }

            // In production: send paymentMethod.id + plan to your backend
            // to create a Stripe subscription. Here we simulate success.
            console.log('Payment method created:', paymentMethod.id)

            // Simulate API call
            await new Promise(r => setTimeout(r, 1200))

            setSuccess(true)
        } catch (err) {
            setError('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 20, padding: '60px 20px', textAlign: 'center',
            }}>
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'rgba(52,211,153,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s infinite',
                }}>
                    <CheckCircle2 size={40} color="var(--green)" strokeWidth={1.5} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)' }}>
                    تم الدفع بنجاح! 🎉
                </h2>
                <p style={{ color: 'var(--text-3)', fontSize: 14, maxWidth: 320, lineHeight: 1.8 }}>
                    تم تفعيل باقة <strong style={{ color: 'var(--text-1)' }}>{PLANS[plan]?.name}</strong> على حسابك.
                    ستصلك رسالة تأكيد على بريدك الإلكتروني.
                </p>
                <Link to="/" className="btn btn-primary" style={{ marginTop: 8 }}>
                    الذهاب للوحة التحكم
                    <ArrowRight size={16} />
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* personal info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    المعلومات الشخصية
                </h3>
                <div style={{ display: 'grid', gap: 12 }}>
                    <FormField label="الاسم الكامل">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="محمد أحمد"
                            required
                            style={inputStyle}
                        />
                    </FormField>
                    <FormField label="البريد الإلكتروني">
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            dir="ltr"
                            style={{ ...inputStyle, textAlign: 'left' }}
                        />
                    </FormField>
                </div>
            </div>

            {/* card info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    بيانات البطاقة
                </h3>
                <div style={{ display: 'grid', gap: 12 }}>
                    <FormField label="رقم البطاقة" error={cardErrors.number}>
                        <div style={stripeInputStyle}>
                            <CreditCard size={16} color="var(--text-4)" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <CardNumberElement options={ELEMENT_STYLE} onChange={handleCardChange('number')} />
                            </div>
                        </div>
                    </FormField>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FormField label="تاريخ الانتهاء" error={cardErrors.expiry}>
                            <div style={stripeInputStyle}>
                                <CardExpiryElement options={ELEMENT_STYLE} onChange={handleCardChange('expiry')} />
                            </div>
                        </FormField>
                        <FormField label="رمز CVV" error={cardErrors.cvc}>
                            <div style={stripeInputStyle}>
                                <CardCvcElement options={ELEMENT_STYLE} onChange={handleCardChange('cvc')} />
                            </div>
                        </FormField>
                    </div>
                </div>
            </div>

            {/* error message */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#f87171', fontSize: 13,
                }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    {error}
                </div>
            )}

            {/* order summary */}
            <div style={{
                padding: '14px 18px',
                background: 'var(--bg-3)',
                border: '1px solid var(--border-1)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {annual ? 'الإجمالي السنوي' : 'الإجمالي الشهري'}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
                    {toArabicNumerals(totalMonthly)} ر.س
                </span>
            </div>

            {/* submit */}
            <button
                type="submit"
                disabled={!stripe || loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: 15, marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
                {loading ? (
                    <>
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        جارٍ المعالجة...
                    </>
                ) : (
                    <>
                        <Lock size={16} />
                        ادفع {toArabicNumerals(totalMonthly)} ر.س الآن
                    </>
                )}
            </button>

            <p style={{ fontSize: 11.5, color: 'var(--text-4)', textAlign: 'center', lineHeight: 1.7 }}>
                بالنقر على "ادفع الآن" أنت توافق على{' '}
                <Link to="/terms" style={{ color: 'var(--accent)' }}>شروط الخدمة</Link>
                {' '}و{' '}
                <Link to="/privacy" style={{ color: 'var(--accent)' }}>سياسة الخصوصية</Link>.
                يمكنك إلغاء اشتراكك في أي وقت.
            </p>
        </form>
    )
}

function FormField({ label, error, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
            {children}
            {error && <span style={{ fontSize: 11.5, color: '#f87171' }}>{error}</span>}
        </label>
    )
}

const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-1)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 150ms',
    fontFamily: 'inherit',
}

const stripeInputStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '13px 14px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'text',
}

// ─── main page ─────────────────────────────────────────────────────────────────
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder')

const stripeAppearance = {
    theme: 'night',
    variables: {
        colorPrimary: '#006c35',
        colorBackground: '#0f172a',
        colorText: '#f1f5f9',
        colorDanger: '#f87171',
        borderRadius: '8px',
        fontFamily: 'Inter, system-ui, sans-serif',
    },
}

export default function Payment() {
    const [params] = useSearchParams()
    const planId = params.get('plan') || 'starter'
    const billing = params.get('billing') || 'monthly'
    const plan = PLANS[planId]

    const annual = billing === 'annual'
    const price = plan ? (annual ? plan.annualPrice : plan.monthlyPrice) : 0

    if (!plan) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: 'var(--text-3)' }}>الباقة المحددة غير موجودة.</p>
                <Link to="/pricing" className="btn btn-secondary">العودة للأسعار</Link>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-1)',
            paddingTop: 80,
            paddingBottom: 80,
            direction: 'rtl',
        }}>
            {/* top bar */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 60,
                background: 'rgba(15,23,42,0.9)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid var(--border-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 32px',
                zIndex: 100,
            }}>
                <Link to="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 14, fontWeight: 500 }}>
                    <ArrowRight size={16} />
                    العودة للأسعار
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'linear-gradient(135deg, var(--accent), #0a8244)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Sparkles size={14} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>WBA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 13 }}>
                    <Lock size={14} />
                    <span>دفع آمن بـ Stripe</span>
                </div>
            </div>

            <div className="container" style={{ maxWidth: 1000 }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.1fr',
                    gap: 32,
                    alignItems: 'start',
                }}>

                    {/* ═══ LEFT: order summary ══════════════════════════════════════ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* plan card */}
                        <div style={{
                            background: 'var(--bg-2)',
                            border: `1px solid ${plan.popular ? 'rgba(0,108,53,0.3)' : 'var(--border-1)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '28px 24px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {plan.popular && (
                                <div style={{
                                    position: 'absolute', top: 0, right: 0, left: 0,
                                    height: 2,
                                    background: 'linear-gradient(90deg, var(--accent), #0a8244)',
                                }} />
                            )}
                            {plan.popular && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '4px 10px',
                                    background: 'rgba(0,108,53,0.12)',
                                    border: '1px solid rgba(0,108,53,0.25)',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                                    marginBottom: 12,
                                }}>
                                    <Sparkles size={10} />
                                    الأكثر شيوعاً
                                </div>
                            )}

                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
                                باقة {plan.name}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>{plan.desc}</div>

                            {/* price display */}
                            <div style={{
                                display: 'flex', alignItems: 'baseline', gap: 6,
                                marginBottom: annual ? 6 : 20,
                            }}>
                                <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>
                                    {toArabicNumerals(price)}
                                </span>
                                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>ر.س</span>
                                <span style={{ fontSize: 13, color: 'var(--text-4)' }}>/شهر</span>
                            </div>
                            {annual && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    marginBottom: 20, fontSize: 12,
                                }}>
                                    <span style={{ color: 'var(--text-4)', textDecoration: 'line-through' }}>
                                        {toArabicNumerals(plan.monthlyPrice)} ر.س/شهر
                                    </span>
                                    <span style={{
                                        padding: '2px 8px',
                                        background: 'rgba(52,211,153,0.1)',
                                        border: '1px solid rgba(52,211,153,0.2)',
                                        borderRadius: 'var(--radius-full)',
                                        color: 'var(--green)', fontWeight: 600,
                                    }}>
                                        وفّر ٢٠٪
                                    </span>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {plan.features.map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text-2)' }}>
                                        <Check size={15} color="var(--green)" style={{ flexShrink: 0 }} />
                                        {f}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* billing type */}
                        <div style={{
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border-1)',
                            borderRadius: 'var(--radius-md)',
                            padding: '20px 24px',
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12 }}>ملخص الطلب</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Row label="نوع الاشتراك" value={annual ? 'سنوي' : 'شهري'} />
                                <Row label={`السعر × ${annual ? '١٢ شهراً' : 'شهر'}`} value={`${toArabicNumerals(price)} ر.س`} />
                                <div style={{ height: 1, background: 'var(--border-1)', margin: '4px 0' }} />
                                <Row
                                    label="الإجمالي"
                                    value={`${toArabicNumerals(annual ? price * 12 : price)} ر.س`}
                                    bold
                                />
                                <Row label="العملة" value="ريال سعودي (SAR)" />
                            </div>
                        </div>

                        {/* trust badges */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { icon: Shield, label: 'مدفوعات آمنة', sub: 'مشفرة بـ SSL 256-bit' },
                                { icon: Lock, label: 'بيانات محمية', sub: 'معيار PCI DSS' },
                            ].map(({ icon: Icon, label, sub }) => (
                                <div key={label} style={{
                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                    padding: '14px 16px',
                                    background: 'var(--bg-2)',
                                    border: '1px solid var(--border-1)',
                                    borderRadius: 'var(--radius-sm)',
                                }}>
                                    <div style={{
                                        width: 32, height: 32,
                                        background: 'rgba(52,211,153,0.1)',
                                        borderRadius: 8,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Icon size={15} color="var(--green)" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* stripe badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '12px 0',
                        }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>الدفع يتم عبر</span>
                            <StripeLogo />
                        </div>
                    </div>

                    {/* ═══ RIGHT: checkout form ═════════════════════════════════════ */}
                    <div style={{
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border-1)',
                        borderRadius: 'var(--radius-md)',
                        padding: '32px 28px',
                        position: 'sticky',
                        top: 80,
                    }}>
                        <div style={{ marginBottom: 28 }}>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                                إتمام الدفع
                            </h1>
                            <p style={{ fontSize: 13.5, color: 'var(--text-3)' }}>
                                أدخل بيانات بطاقتك لتفعيل باقة {plan.name}
                            </p>
                        </div>

                        <Elements stripe={stripePromise} options={{ appearance: stripeAppearance }}>
                            <CheckoutForm plan={planId} billing={billing} price={price} />
                        </Elements>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); }
                    50% { box-shadow: 0 0 0 14px rgba(52,211,153,0); }
                }
                input:focus { border-color: var(--accent) !important; outline: none; }
                @media (max-width: 720px) {
                    .payment-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    )
}

function Row({ label, value, bold }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: bold ? 'var(--text-1)' : 'var(--text-3)', fontWeight: bold ? 600 : 400 }}>{label}</span>
            <span style={{ fontSize: 13, color: bold ? 'var(--text-1)' : 'var(--text-2)', fontWeight: bold ? 700 : 500 }}>{value}</span>
        </div>
    )
}

function StripeLogo() {
    return (
        <svg width="48" height="20" viewBox="0 0 48 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.456 7.818c0-.646.532-1.032 1.332-1.032.97 0 1.907.244 2.778.73V4.934c-.92-.365-1.843-.487-2.778-.487C4.218 4.447 2.5 5.723 2.5 7.94c0 3.47 4.787 2.922 4.787 4.42 0 .768-.667 1.094-1.516 1.094-1.035 0-2.07-.365-3.004-.912v2.638c1.035.487 2.07.73 3.004.73 2.32 0 4.16-1.155 4.16-3.45-.003-3.748-4.475-3.078-4.475-4.642zM18.61 4.69l-1.92.425-.004 6.587c0 1.215.91 1.99 2.124 1.99.67 0 1.16-.122 1.436-.268v-1.86c-.261.12-.544.18-.838.18-.7 0-1.034-.306-1.034-1.095V7.212h1.87V5.23H18.61V4.69zM22.64 5.23h-2.242v8.338H22.64V5.23zm0-2.09c0-.64-.52-1.14-1.12-1.14s-1.12.5-1.12 1.14c0 .644.52 1.14 1.12 1.14s1.12-.496 1.12-1.14zM27.32 5.048c-.98 0-1.752.464-2.17 1.154l-.184-.972H22.9v8.338h2.247V9.15c0-1.094.484-1.68 1.39-1.68.29 0 .58.061.861.183V5.11a3.15 3.15 0 00-.878-.062zM35.086 9.394c0-2.517-1.388-4.163-3.566-4.163-2.246 0-3.634 1.707-3.634 4.224 0 2.8 1.62 4.162 3.977 4.162 1.14 0 2.006-.244 2.667-.67v-1.89c-.618.43-1.372.68-2.317.68-1.034 0-1.97-.397-2.063-1.768h5.91c-.006-.183.026-.365.026-.575zm-5.93-.67c.1-1.26.859-1.83 1.64-1.83.853 0 1.547.594 1.592 1.83h-3.232zM42.8 7.818c0-.646.532-1.032 1.332-1.032.969 0 1.906.244 2.778.73V4.934c-.92-.365-1.843-.487-2.778-.487-2.548 0-4.266 1.276-4.266 3.493 0 3.47 4.787 2.922 4.787 4.42 0 .768-.667 1.094-1.516 1.094-1.035 0-2.07-.365-3.004-.912v2.638c1.035.487 2.07.73 3.004.73 2.32 0 4.16-1.155 4.16-3.45-.003-3.748-4.497-3.078-4.497-4.642z" fill="#6772E5"/>
        </svg>
    )
}
