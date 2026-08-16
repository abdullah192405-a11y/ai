import { useState } from 'react';

/**
 * Shared login form for admin and user dashboards.
 */
export default function LoginForm({
  icon: Icon,
  brandTitle,
  brandSubtitle,
  heading = 'تسجيل الدخول',
  description,
  defaultEmail = '',
  onLogin,
  login,
  headerExtra,
  submitIcon: SubmitIcon,
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login(email.trim(), password);
      onLogin({ token, user });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-0)',
        direction: 'rtl',
        padding: 20,
        position: 'relative',
      }}
    >
      {headerExtra}
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--bg-2)',
          border: '1px solid var(--border-1)',
          borderRadius: 'var(--radius-md)',
          padding: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-1)' }}>{brandTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{brandSubtitle}</div>
          </div>
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 700, margin: '18px 0 4px', color: 'var(--text-1)' }}>
          {heading}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18 }}>{description}</p>

        <div className="field">
          <label className="field-label">البريد الإلكتروني</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>
        <div className="field">
          <label className="field-label">كلمة المرور</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: '#f87171',
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {SubmitIcon ? <SubmitIcon size={15} /> : null} {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
