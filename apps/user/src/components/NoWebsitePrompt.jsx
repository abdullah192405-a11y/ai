import { Globe, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenantWebsites } from '../hooks/useTenantWebsites';
import { needsOwnershipVerify } from '../lib/websiteOwnership';
import LoadingState from './LoadingState';

export default function NoWebsitePrompt({ title = 'أضف موقعاً للمتابعة' }) {
  return (
    <div className="card anim-in" style={{ marginTop: 20 }}>
      <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div
          className="stat-icon purple"
          style={{ width: 56, height: 56, margin: '0 auto 16px' }}
        >
          <Globe size={26} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 420, margin: '0 auto 20px' }}>
          أضف موقعك من تبويب المواقع أولاً. بعدها تُثبِت الملكية ثم تزحف الصفحات.
        </p>
        <Link to="/websites" className="btn btn-primary">
          <Plus size={15} /> إضافة موقع
        </Link>
      </div>
    </div>
  );
}

function VerifyOwnershipPrompt({ domain }) {
  return (
    <div className="card anim-in" style={{ marginTop: 20 }}>
      <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div
          className="stat-icon"
          style={{ width: 56, height: 56, margin: '0 auto 16px', background: 'var(--amber-muted)' }}
        >
          <ShieldCheck size={26} style={{ color: 'var(--amber)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>أثبت ملكية موقعك أولاً</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 420, margin: '0 auto 20px' }}>
          أُضيف النطاق {domain ? <code style={{ direction: 'ltr' }}>{domain}</code> : 'الخاص بك'} —
          أكمل التحقق من تبويب المواقع قبل الزحف أو التثبيت.
        </p>
        <Link to="/websites" className="btn btn-primary">
          <ShieldCheck size={15} /> إكمال التحقق
        </Link>
      </div>
    </div>
  );
}

export function RequireWebsite({ user, children }) {
  const { active, loading } = useTenantWebsites(user);

  if (!user?.websiteId) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-left">
            <h1>يتطلب موقعاً</h1>
            <p>أضف موقعك من تبويب المواقع للمتابعة</p>
          </div>
        </div>
        <NoWebsitePrompt />
      </>
    );
  }

  if (loading) {
    return <LoadingState />;
  }

  if (needsOwnershipVerify(active)) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-left">
            <h1>يتطلب إثبات ملكية</h1>
            <p>وثّق النطاق من تبويب المواقع قبل المتابعة</p>
          </div>
        </div>
        <VerifyOwnershipPrompt domain={active?.domain} />
      </>
    );
  }

  return children;
}
