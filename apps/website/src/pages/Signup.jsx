import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, UserPlus, LogIn, Eye, EyeOff,
  Check, Shield, Zap, HeadphonesIcon, ChevronRight, Bot,
} from 'lucide-react';
import { signup, buildAuthHandoffUrlFromSession } from '../api';
import { urls } from '../lib/urls';
import { PLAN_CATALOG } from '@wba/plans';

/* ── password strength ── */
function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 0, label: 'ضعيفة جداً', color: '#f87171' };
  if (score === 2) return { level: 1, label: 'ضعيفة', color: '#fb923c' };
  if (score === 3) return { level: 2, label: 'متوسطة', color: '#fbbf24' };
  if (score === 4) return { level: 3, label: 'قوية', color: '#0a8244' };
  return { level: 4, label: 'ممتازة', color: '#006c35' };
}

const PLAN_LABELS = Object.fromEntries(
  PLAN_CATALOG.map((p) => [
    p.id,
    {
      name: p.name,
      badge:
        p.monthlyPrice == null ? 'مخصص' : p.monthlyPrice === 0 ? '٠٪' : `${p.price}/شهر`,
      color: p.color?.startsWith('var(') ? '#006c35' : p.color || '#006c35',
    },
  ])
);

const PERKS = [
  { icon: <Zap size={15} />, text: 'جاهز خلال دقيقتين' },
  { icon: <Shield size={15} />, text: 'بدون بطاقة ائتمان' },
  { icon: <Check size={15} />, text: '١٤ يوم تجربة مجانية' },
  { icon: <HeadphonesIcon size={15} />, text: 'دعم فني ٢٤/٧' },
];

export default function Signup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plan = params.get('plan') || 'free';
  const planInfo = PLAN_LABELS[plan] || PLAN_LABELS.free;

  /* apply saved theme without the Layout being mounted */
  useEffect(() => {
    const saved = localStorage.getItem('wba-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getStrength(password), [password]);

  const fieldError = {
    name: touched.name && name.trim().length < 2 ? 'أدخل اسم المشروع' : '',
    email: touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'بريد إلكتروني غير صحيح' : '',
    password: touched.password && password.length < 6 ? 'كلمة المرور قصيرة جداً (٦ أحرف كحد أدنى)' : '',
    confirm: touched.confirm && confirm && confirm !== password ? 'كلمتا المرور غير متطابقتين' : '',
  };

  const mark = (f) => setTouched(p => ({ ...p, [f]: true }));

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    setError('');

    if (Object.values(fieldError).some(Boolean)) return;
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      const session = await signup({ name: name.trim(), email: email.trim(), password, plan });
      window.location.href = buildAuthHandoffUrlFromSession(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Minimal top bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 60,
          borderBottom: '1px solid var(--border-1)',
          background: 'var(--bg-2)',
          flexShrink: 0,
        }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-3)',
            fontSize: 13,
            fontWeight: 500,
            padding: '6px 10px',
            borderRadius: 8,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'none'; }}
        >
          <ChevronRight size={16} />
          رجوع
        </button>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'var(--gradient-cta)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Bot size={17} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-1)' }}>WBA</span>
        </Link>

        {/* Login link */}
        <a
          href={urls.login}
          style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', fontWeight: 500 }}
        >
          تسجيل الدخول
        </a>
      </div>

    <section
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px 80px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 880, display: 'flex', gap: 40, alignItems: 'flex-start' }}>

        {/* ── Left panel: benefits ── */}
        <div
          className="signup-benefits"
          style={{
            flex: '1 1 340px',
            padding: '36px 32px',
            background: 'var(--gradient-subtle)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-xl)',
            position: 'sticky',
            top: 'calc(var(--nav-h) + 24px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--gradient-cta)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 16px rgba(0,108,53,0.35)',
              }}
            >
              <Sparkles size={22} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-1)' }}>WBA</span>
          </div>

          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.4,
              color: 'var(--text-1)',
              marginBottom: 10,
            }}
          >
            مساعد ذكي لموقعك
            <br />
            <span
              style={{
                background: 'var(--gradient-text)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              يعمل على مدار الساعة
            </span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.8, marginBottom: 28 }}>
            أضف chatbot ذكي لموقعك بسطر كود واحد. يفهم محتوى موقعك ويرد على زوارك تلقائياً.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {PERKS.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--accent-muted)',
                    border: '1px solid var(--accent-border)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent-hover)',
                    flexShrink: 0,
                  }}
                >
                  {p.icon}
                </div>
                <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{p.text}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--bg-3)',
              borderRadius: 12,
              border: '1px solid var(--border-2)',
            }}
          >
            <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: '#fbbf24', fontSize: 13 }}>★</span>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>
              "زاد معدل الردود ٣ أضعاف بعد إضافة WBA لموقعنا. الإعداد أخذ حرفياً دقيقتين."
            </p>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
              — أحمد السالم، مؤسس متجر إلكتروني
            </div>
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div
          style={{
            flex: '1 1 360px',
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 32px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Plan badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              background: `${planInfo.color}18`,
              border: `1px solid ${planInfo.color}35`,
              marginBottom: 20,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: planInfo.color, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: planInfo.color, fontWeight: 600 }}>
              الباقة {planInfo.name} — {planInfo.badge}
            </span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-1)' }}>
            إنشاء حساب جديد
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.7 }}>
            أنشئ حسابك في ثوانٍ وأضف موقعك الأول من لوحة التحكم.
          </p>

          <form onSubmit={submit} noValidate>

            {/* Name */}
            <FieldGroup
              label="اسم الشركة أو المشروع"
              error={fieldError.name}
            >
              <input
                className={`input${fieldError.name ? ' input-error' : ''}`}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => mark('name')}
                placeholder="مثال: متجري الإلكتروني"
                required
                autoComplete="organization"
                autoFocus
              />
            </FieldGroup>

            {/* Email */}
            <FieldGroup
              label="البريد الإلكتروني"
              error={fieldError.email}
            >
              <input
                className={`input${fieldError.email ? ' input-error' : ''}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => mark('email')}
                placeholder="you@company.com"
                required
                autoComplete="email"
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
            </FieldGroup>

            {/* Password */}
            <FieldGroup
              label="كلمة المرور"
              error={fieldError.password}
            >
              <div style={{ position: 'relative' }}>
                <input
                  className={`input${fieldError.password ? ' input-error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => mark('password')}
                  placeholder="٦ أحرف على الأقل"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ direction: 'ltr', textAlign: 'left', paddingLeft: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-4)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: 3,
                          borderRadius: 99,
                          background: i <= strength.level ? strength.color : 'var(--border-2)',
                          transition: 'background 0.25s',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 11.5, color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </FieldGroup>

            {/* Confirm password */}
            <FieldGroup
              label="تأكيد كلمة المرور"
              error={fieldError.confirm}
            >
              <div style={{ position: 'relative' }}>
                <input
                  className={`input${fieldError.confirm ? ' input-error' : ''}`}
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => mark('confirm')}
                  placeholder="أعد كتابة كلمة المرور"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ direction: 'ltr', textAlign: 'left', paddingLeft: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-4)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {confirm && confirm === password && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#006c35',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Check size={15} />
                  </div>
                )}
              </div>
            </FieldGroup>

            {/* Global error */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: 'var(--red)',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: 16 }}>⚠</span>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: 6,
                height: 48,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 0.3,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(0,108,53,0.35)',
                transition: 'opacity 0.2s, box-shadow 0.2s',
              }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  جاري إنشاء الحساب...
                </>
              ) : (
                <>
                  <UserPlus size={17} />
                  ابدأ مجاناً الآن
                </>
              )}
            </button>

            <p style={{ fontSize: 11.5, color: 'var(--text-4)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
              بالتسجيل فأنت توافق على{' '}
              <a href="#" style={{ color: 'var(--text-3)' }}>شروط الاستخدام</a>
              {' '}و{' '}
              <a href="#" style={{ color: 'var(--text-3)' }}>سياسة الخصوصية</a>
            </p>
          </form>

          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid var(--border-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              لديك حساب بالفعل؟{' '}
              <a href={urls.login} style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>
                <LogIn size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                تسجيل الدخول
              </a>
            </p>
            <Link
              to="/pricing"
              style={{
                fontSize: 12.5,
                color: 'var(--text-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'none',
              }}
            >
              مقارنة الباقات
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}

function FieldGroup({ label, error, children }) {
  return (
    <div className="field" style={{ marginBottom: 18 }}>
      <label className="field-label" style={{ marginBottom: 6, display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
