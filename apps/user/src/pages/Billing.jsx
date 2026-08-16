import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  Check, Crown, Loader2, Receipt, CreditCard,
  Lock, Shield, X, CheckCircle2, AlertCircle,
  ArrowLeft, Sparkles, ChevronDown,
} from 'lucide-react';
import { api, auth } from '../api';
import { PLAN_CATALOG } from '../lib/constants';
import LoadingState from '../components/LoadingState';

// ─── helpers ──────────────────────────────────────────────────────────────────
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'
);

const STRIPE_APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#006c35',
    colorBackground: '#1e293b',
    colorText: '#f1f5f9',
    colorDanger: '#f87171',
    borderRadius: '8px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};

const CARD_STYLE = {
  style: {
    base: {
      fontSize: '14px',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f1f5f9',
      '::placeholder': { color: '#475569' },
    },
    invalid: { color: '#f87171' },
  },
};

function toAr(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// ─── usage bar ────────────────────────────────────────────────────────────────
function UsageBar({ label, used, limit, unit = '' }) {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const nearLimit = !unlimited && pct > 80;
  const atLimit = !unlimited && used >= limit;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>
          <span style={{ color: atLimit ? '#f87171' : nearLimit ? 'var(--amber)' : 'var(--text-1)' }}>
            {Number(used || 0).toLocaleString('ar-SA')}{unit}
          </span>
          <span style={{ color: 'var(--text-4)' }}>
            {' / '}
            {unlimited ? 'بلا حد' : `${Number(limit).toLocaleString('ar-SA')}${unit}`}
          </span>
        </span>
      </div>
      {!unlimited && (
        <>
          <div className="progress" style={{ height: 8 }}>
            <div
              className={`progress-fill ${atLimit || nearLimit ? 'amber' : 'purple'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
            {pct.toFixed(0)}٪ مستخدم
          </div>
        </>
      )}
    </div>
  );
}

// ─── stripe checkout form (inner) ─────────────────────────────────────────────
function StripeForm({ plan, billing, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardErrors, setCardErrors] = useState({ number: null, expiry: null, cvc: null });

  const annual = billing === 'annual';
  const price = annual ? plan.annualPrice : plan.monthlyPrice;
  const total = annual ? price * 12 : price;

  function handleCardChange(field) {
    return (e) => setCardErrors((prev) => ({ ...prev, [field]: e.error?.message || null }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);

    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardNumberElement),
        billing_details: { name, email },
      });

      if (pmError) {
        setError(pmError.message);
        setLoading(false);
        return;
      }

      // In production: POST paymentMethod.id + plan.id + billing to backend
      // to create a Stripe subscription, then call api.changePlan() with the result.
      console.log('paymentMethod.id:', paymentMethod.id, '| plan:', plan.id, '| billing:', billing);

      // Simulate API round-trip
      await new Promise((r) => setTimeout(r, 1400));

      onSuccess(plan.id);
    } catch {
      setError('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* personal */}
      <div>
        <div style={sectionLabel}>المعلومات الشخصية</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="الاسم الكامل">
            <input
              type="text" required value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="محمد أحمد"
              style={inputSt}
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              dir="ltr"
              style={{ ...inputSt, textAlign: 'left' }}
            />
          </Field>
        </div>
      </div>

      {/* card */}
      <div>
        <div style={sectionLabel}>بيانات البطاقة</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="رقم البطاقة" error={cardErrors.number}>
            <div style={stripeSt}>
              <CreditCard size={15} color="var(--text-4)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <CardNumberElement options={CARD_STYLE} onChange={handleCardChange('number')} />
              </div>
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="تاريخ الانتهاء" error={cardErrors.expiry}>
              <div style={stripeSt}>
                <CardExpiryElement options={CARD_STYLE} onChange={handleCardChange('expiry')} />
              </div>
            </Field>
            <Field label="CVV" error={cardErrors.cvc}>
              <div style={stripeSt}>
                <CardCvcElement options={CARD_STYLE} onChange={handleCardChange('cvc')} />
              </div>
            </Field>
          </div>
        </div>
      </div>

      {/* error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 8, color: '#f87171', fontSize: 13,
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--bg-3, rgba(255,255,255,0.04))',
        border: '1px solid var(--border-1)',
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {annual ? 'الإجمالي السنوي' : 'الإجمالي الشهري'}
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>
          {toAr(total)} ر.س
        </span>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={onCancel}
          disabled={loading}
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ flex: 2, justifyContent: 'center', opacity: loading ? 0.75 : 1 }}
          disabled={!stripe || loading}
        >
          {loading ? (
            <><Loader2 size={15} className="spin" /> جارٍ المعالجة...</>
          ) : (
            <><Lock size={14} /> ادفع {toAr(total)} ر.س</>
          )}
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
        الدفع مؤمَّن بتشفير SSL عبر Stripe · PCI DSS Level 1
      </p>
    </form>
  );
}

// ─── payment modal ────────────────────────────────────────────────────────────
function PaymentModal({ plan, currentPlanId, onSuccess, onClose }) {
  const [billing, setBilling] = useState('monthly');
  const [done, setDone] = useState(false);

  const isUpgrade =
    PLAN_CATALOG.findIndex((p) => p.id === plan.id) >
    PLAN_CATALOG.findIndex((p) => p.id === currentPlanId);

  function handleSuccess(planId) {
    setDone(true);
    setTimeout(() => onSuccess(planId), 1800);
  }

  const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
        borderRadius: 16,
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        position: 'relative',
        animation: 'fadeInUp 200ms ease both',
      }}>
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {isUpgrade ? 'ترقية' : 'تغيير'} إلى باقة {plan.name}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
              أدخل بيانات الدفع لتفعيل الاشتراك
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-3)', color: 'var(--text-3)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 16, padding: '48px 32px', textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(52,211,153,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={36} color="var(--green)" strokeWidth={1.5} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                تم الدفع بنجاح!
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
                تم تفعيل باقة <strong style={{ color: 'var(--text-1)' }}>{plan.name}</strong>. ستصلك رسالة تأكيد على بريدك الإلكتروني.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* plan summary strip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'var(--bg-3, rgba(0,108,53,0.06))',
              border: '1px solid var(--border-1)',
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {plan.popular && <Sparkles size={14} color="var(--accent)" />}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                    باقة {plan.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{plan.desc}</div>
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>
                  {toAr(price)}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginRight: 3 }}>ر.س/شهر</span>
                </div>
                {billing === 'annual' && (
                  <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>وفّر ٢٠٪</div>
                )}
              </div>
            </div>

            {/* billing toggle */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-3)',
              border: '1px solid var(--border-1)',
              borderRadius: 10, padding: 4, gap: 4,
            }}>
              {[
                { id: 'monthly', label: 'شهري' },
                { id: 'annual', label: 'سنوي', badge: 'وفّر ٢٠٪' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBilling(opt.id)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 7,
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: billing === opt.id ? 'var(--accent)' : 'transparent',
                    color: billing === opt.id ? '#fff' : 'var(--text-3)',
                    transition: 'all 160ms',
                  }}
                >
                  {opt.label}
                  {opt.badge && billing !== opt.id && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px',
                      borderRadius: 20, background: 'rgba(52,211,153,0.15)', color: 'var(--green)',
                    }}>
                      {opt.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* stripe form */}
            <Elements stripe={stripePromise} options={{ appearance: STRIPE_APPEARANCE }}>
              <StripeForm
                plan={plan}
                billing={billing}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </Elements>

            {/* trust row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {[
                { icon: Shield, label: 'SSL مشفر' },
                { icon: Lock, label: 'PCI DSS' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-4)' }}>
                  <Icon size={12} />
                  {label}
                </div>
              ))}
              <StripeBadge />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, currentPlanId, billing, changingPlan, onUpgrade }) {
  const isCurrent = plan.id === currentPlanId;
  const isEnterprise = plan.monthlyPrice === null;
  const currentIdx = PLAN_CATALOG.findIndex((p) => p.id === currentPlanId);
  const planIdx = PLAN_CATALOG.findIndex((p) => p.id === plan.id);
  const isDowngrade = planIdx < currentIdx;
  const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;

  return (
    <div className={`plan-card anim-in ${isCurrent ? 'is-current' : ''}`}>
      {plan.popular && !isCurrent && (
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
          <Sparkles size={10} style={{ verticalAlign: 'middle', marginLeft: 3 }} />
          الأكثر شيوعاً
        </div>
      )}
      <div className="plan-name" style={{ color: plan.color }}>{plan.name}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12 }}>{plan.desc}</div>

      <div className="plan-price">
        {isEnterprise ? (
          'مخصص'
        ) : (
          <>
            {toAr(price)}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginRight: 4 }}>ر.س</span>
            <small>/شهر</small>
          </>
        )}
      </div>

      {billing === 'annual' && !isEnterprise && plan.monthlyPrice > 0 && (
        <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 10, textAlign: 'center' }}>
          بدلاً من {toAr(plan.monthlyPrice)} ر.س/شهر
        </div>
      )}

      <ul className="plan-list">
        {plan.features.map((f, i) => (
          <li key={i}><Check size={14} /> {f}</li>
        ))}
      </ul>

      {isCurrent ? (
        <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled>
          <CheckCircle2 size={14} /> الباقة الحالية
        </button>
      ) : isEnterprise ? (
        <a href="mailto:support@wba.ai" className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          تواصل مع المبيعات
        </a>
      ) : plan.id === 'free' ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%' }}
          disabled={changingPlan != null}
          onClick={() => onUpgrade(plan)}
        >
          {changingPlan === plan.id ? <Loader2 size={14} className="spin" /> : 'التبديل للمجانية'}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={changingPlan != null}
          onClick={() => onUpgrade(plan)}
        >
          {changingPlan === plan.id ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <>{isDowngrade ? 'تخفيض' : 'ترقية'} <ArrowLeft size={14} /></>
          )}
        </button>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function Billing() {
  const [tab, setTab] = useState('overview');
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(null);
  const [flash, setFlash] = useState('');
  const [billing, setBilling] = useState('monthly');
  const [payingPlan, setPayingPlan] = useState(null);

  const loadUsage = useCallback(() => {
    setLoading(true);
    return api
      .getUsage()
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadUsage(); }, [loadUsage]);

  const currentPlan = PLAN_CATALOG.find((p) => p.id === usage?.plan) || PLAN_CATALOG[0];

  function openPayment(plan) {
    if (plan.id === usage?.plan) return;
    if (plan.monthlyPrice === 0) {
      // downgrade to free: no payment needed
      handleFreePlan();
      return;
    }
    setPayingPlan(plan);
  }

  async function handleFreePlan() {
    if (!window.confirm('التبديل إلى الباقة المجانية؟')) return;
    setChangingPlan('free');
    setFlash('');
    try {
      const result = await api.changePlan('free');
      auth.updateSession({ token: result.token, user: result.user });
      setUsage(result.usage);
      setFlash(result.message || 'تم التبديل إلى الباقة المجانية');
    } catch (err) {
      setFlash(err.message);
    } finally {
      setChangingPlan(null);
    }
  }

  async function handlePaymentSuccess(planId) {
    setPayingPlan(null);
    setChangingPlan(planId);
    setFlash('');
    try {
      const result = await api.changePlan(planId);
      auth.updateSession({ token: result.token, user: result.user });
      setUsage(result.usage);
      const label = PLAN_CATALOG.find((p) => p.id === planId)?.name || planId;
      setFlash(`تم تفعيل باقة ${label} بنجاح 🎉`);
      setTab('overview');
    } catch (err) {
      setFlash(err.message);
    } finally {
      setChangingPlan(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>الفوترة والباقات</h1>
          <p>إدارة اشتراكك والاستخدام</p>
        </div>
        <div className="topbar-right">
          <span className="badge badge-purple">
            <Crown size={12} /> باقة {usage?.planLabel || currentPlan.name}
          </span>
        </div>
      </div>

      {flash && (
        <div className="card anim-in" style={{
          marginBottom: 16,
          borderColor: flash.includes('تم') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
        }}>
          <div className="card-body" style={{
            fontSize: 13,
            color: flash.includes('تم') ? 'var(--green)' : '#f87171',
          }}>
            {flash}
          </div>
        </div>
      )}

      <div className="page-tabs">
        {[
          { id: 'overview', label: 'نظرة عامة' },
          { id: 'plans', label: 'الباقات والأسعار' },
          { id: 'invoices', label: 'الفواتير' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`page-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ overview tab ═══ */}
      {tab === 'overview' && (
        loading ? <LoadingState /> : (
          <div className="grid-2-1">
            <div className="card anim-in">
              <div className="card-head">
                <h3>الاستخدام الحالي</h3>
                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  الشهر الحالي — تُعاد العدادات أول كل شهر
                </span>
              </div>
              <div className="card-body">
                <UsageBar label="الاستعلامات (هذا الشهر)" used={usage?.used?.queriesThisMonth} limit={usage?.limits?.queriesPerMonth} />
                <UsageBar label="المواقع" used={usage?.used?.websites} limit={usage?.limits?.websites} />
                <UsageBar label="المستندات (الموقع الحالي)" used={usage?.used?.documentsOnWebsite} limit={usage?.limits?.documentsPerWebsite} />
                <UsageBar label="مفاتيح API" used={usage?.used?.apiKeys} limit={usage?.limits?.apiKeys} />
              </div>
            </div>

            <div className="card anim-in">
              <div className="card-body">
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
                    الباقة الحالية
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em' }}>
                    {currentPlan.monthlyPrice === 0
                      ? '٠ ر.س'
                      : currentPlan.monthlyPrice === null
                      ? 'مخصص'
                      : <>{toAr(currentPlan.monthlyPrice)}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)' }}> ر.س</span></>
                    }
                    {currentPlan.monthlyPrice !== null && currentPlan.monthlyPrice > 0 && (
                      <small style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)' }}>/شهر</small>
                    )}
                  </div>
                  <div style={{ marginTop: 4, color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>
                    {usage?.planLabel || currentPlan.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.6 }}>
                    {currentPlan.desc}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-1)', margin: '16px 0 14px' }} />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setTab('plans')}
                >
                  <Sparkles size={14} /> ترقية الباقة
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ═══ plans tab ═══ */}
      {tab === 'plans' && (
        <>
          {/* billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-1)',
              borderRadius: 10, padding: 4, gap: 4,
            }}>
              {[
                { id: 'monthly', label: 'شهري' },
                { id: 'annual', label: 'سنوي', badge: 'وفّر ٢٠٪' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBilling(opt.id)}
                  style={{
                    padding: '8px 22px', borderRadius: 7,
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                    background: billing === opt.id ? 'var(--accent)' : 'transparent',
                    color: billing === opt.id ? '#fff' : 'var(--text-3)',
                    transition: 'all 160ms',
                  }}
                >
                  {opt.label}
                  {opt.badge && billing !== opt.id && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      borderRadius: 20, background: 'rgba(52,211,153,0.15)', color: 'var(--green)',
                    }}>
                      {opt.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="billing-plans-grid">
            {PLAN_CATALOG.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                currentPlanId={usage?.plan || 'free'}
                billing={billing}
                changingPlan={changingPlan}
                onUpgrade={openPayment}
              />
            ))}
          </div>
        </>
      )}

      {/* ═══ invoices tab ═══ */}
      {tab === 'invoices' && (
        <div className="card anim-in">
          <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <Receipt size={32} style={{ color: 'var(--text-4)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>الفواتير قريباً</h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 420, margin: '0 auto' }}>
              سجل الفواتير والمدفوعات سيظهر هنا عند تفعيل نظام الدفع بالكامل.
            </p>
          </div>
        </div>
      )}

      {/* ═══ stripe payment modal ═══ */}
      {payingPlan && (
        <PaymentModal
          plan={payingPlan}
          currentPlanId={usage?.plan || 'free'}
          onSuccess={handlePaymentSuccess}
          onClose={() => setPayingPlan(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>}
    </label>
  );
}

const sectionLabel = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-4)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
};

const inputSt = {
  width: '100%', padding: '10px 13px',
  background: 'var(--bg-3)',
  border: '1px solid var(--border-1)',
  borderRadius: 8,
  color: 'var(--text-1)', fontSize: 14,
  fontFamily: 'inherit', outline: 'none',
};

const stripeSt = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 13px',
  background: 'var(--bg-3)',
  border: '1px solid var(--border-1)',
  borderRadius: 8, cursor: 'text',
};

function StripeBadge() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-4)' }}>
      <span>مدعوم بـ</span>
      <svg width="38" height="16" viewBox="0 0 48 20" fill="none">
        <path d="M5.456 7.818c0-.646.532-1.032 1.332-1.032.97 0 1.907.244 2.778.73V4.934c-.92-.365-1.843-.487-2.778-.487C4.218 4.447 2.5 5.723 2.5 7.94c0 3.47 4.787 2.922 4.787 4.42 0 .768-.667 1.094-1.516 1.094-1.035 0-2.07-.365-3.004-.912v2.638c1.035.487 2.07.73 3.004.73 2.32 0 4.16-1.155 4.16-3.45-.003-3.748-4.475-3.078-4.475-4.642zM18.61 4.69l-1.92.425-.004 6.587c0 1.215.91 1.99 2.124 1.99.67 0 1.16-.122 1.436-.268v-1.86c-.261.12-.544.18-.838.18-.7 0-1.034-.306-1.034-1.095V7.212h1.87V5.23H18.61V4.69zM22.64 5.23h-2.242v8.338H22.64V5.23zm0-2.09c0-.64-.52-1.14-1.12-1.14s-1.12.5-1.12 1.14c0 .644.52 1.14 1.12 1.14s1.12-.496 1.12-1.14zM27.32 5.048c-.98 0-1.752.464-2.17 1.154l-.184-.972H22.9v8.338h2.247V9.15c0-1.094.484-1.68 1.39-1.68.29 0 .58.061.861.183V5.11a3.15 3.15 0 00-.878-.062zM35.086 9.394c0-2.517-1.388-4.163-3.566-4.163-2.246 0-3.634 1.707-3.634 4.224 0 2.8 1.62 4.162 3.977 4.162 1.14 0 2.006-.244 2.667-.67v-1.89c-.618.43-1.372.68-2.317.68-1.034 0-1.97-.397-2.063-1.768h5.91c-.006-.183.026-.365.026-.575zm-5.93-.67c.1-1.26.859-1.83 1.64-1.83.853 0 1.547.594 1.592 1.83h-3.232z" fill="#6772E5"/>
      </svg>
    </div>
  );
}
