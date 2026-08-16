import { useState } from 'react';
import { Check, CheckCircle2, Copy, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { needsOwnershipVerify } from '../lib/websiteOwnership';

export default function DomainVerifyCard({ site, onUpdated }) {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!site) return null;

  if (site.verified) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: '14px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--green-muted)',
          border: '1px solid rgba(52,211,153,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <CheckCircle2 size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--green)' }}>الموقع موثّق</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
            تم إثبات ملكية <code style={{ direction: 'ltr' }}>{site.domain}</code>
          </div>
        </div>
      </div>
    );
  }

  if (!needsOwnershipVerify(site)) return null;

  const copyToken = () => {
    navigator.clipboard.writeText(site.verificationToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkNow = async () => {
    setRefreshing(true);
    setError('');
    setMessage('');
    try {
      const { website, verify } = await api.refreshWebsite(site.id);
      if (verify?.verified) {
        setMessage(verify.message || 'تم التحقق من النطاق بنجاح');
      } else {
        setError(verify?.message || 'لم يُعثر على سجل TXT بعد. انتظر انتشار DNS ثم أعد المحاولة.');
      }
      onUpdated?.(website);
    } catch (err) {
      setError(err.message || 'تعذّر التحقق الآن');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: '16px 18px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--amber-muted)',
        border: '1px solid rgba(251,191,36,0.2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} style={{ color: 'var(--amber)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--amber)' }}>
              أثبت أنك تملك هذا الموقع
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.65 }}>
              أضف سجل TXT في لوحة DNS للنطاق{' '}
              <code style={{ direction: 'ltr' }}>{site.domain}</code> ثم اضغط تحقق.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={refreshing}
          onClick={checkNow}
        >
          {refreshing ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
          {refreshing ? 'جاري التحقق...' : 'تحقق الآن'}
        </button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10 }}>
        الاسم/المضيف: <code style={{ direction: 'ltr' }}>@</code>
        {' '}أو{' '}
        <code style={{ direction: 'ltr' }}>_wba.{site.domain}</code>
        <br />
        النوع: <code style={{ direction: 'ltr' }}>TXT</code>
        <br />
        القيمة:
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <code
          style={{
            flex: 1,
            direction: 'ltr',
            textAlign: 'left',
            fontSize: 12,
            background: 'var(--bg-0)',
            padding: '10px 12px',
            borderRadius: 8,
            wordBreak: 'break-all',
            border: '1px solid var(--border-1)',
          }}
        >
          {site.verificationToken}
        </code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyToken} title="نسخ">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'تم' : 'نسخ'}
        </button>
      </div>

      {message && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--red)', lineHeight: 1.6 }}>
          {error}
        </div>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6 }}>
        قد يستغرق انتشار DNS من دقائق إلى 48 ساعة. لا يمكن المتابعة قبل نجاح التحقق.
      </p>
    </div>
  );
}
