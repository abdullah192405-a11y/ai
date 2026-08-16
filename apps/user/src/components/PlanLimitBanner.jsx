import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

const OVER_LIMIT_COPY = {
  websites: (usage, row, over) =>
    `باقة ${usage.planLabel} تسمح بـ ${row.limit} موقع — لديك ${row.used}. الويدجت متوقف على المواقع الإضافية. احذف ${over} موقعاً أو رقِّ باقتك.`,
  apiKeys: (usage, row, over) =>
    `باقة ${usage.planLabel} تسمح بـ ${row.limit} مفتاح — لديك ${row.used}. تم إلغاء المفاتيح الإضافية. احذف ${over} مفتاحاً أو رقِّ باقتك.`,
  documents: (usage, row, over) =>
    `باقة ${usage.planLabel} تسمح بـ ${row.limit} مستند لهذا الموقع — لديك ${row.used}. لا يمكن رفع مستندات جديدة حتى تحذف ${over} أو ترقِّ.`,
  queries: () => '',
};

/** Shows when a plan quota is reached, nearly full, or over limit after downgrade. */
export default function PlanLimitBanner({ usage, kind = 'websites' }) {
  if (kind === 'websites') return null;
  if (!usage?.limits) return null;

  const limitMap = {
    websites: { limit: usage.limits.websites, used: usage.used.websites, label: 'المواقع' },
    queries: { limit: usage.limits.queriesPerMonth, used: usage.used.queriesThisMonth, label: 'الاستعلامات هذا الشهر' },
    documents: {
      limit: usage.limits.documentsPerWebsite,
      used: usage.used.documentsOnWebsite,
      label: 'المستندات لهذا الموقع',
    },
    apiKeys: { limit: usage.limits.apiKeys, used: usage.used.apiKeys, label: 'مفاتيح API' },
  };

  const row = limitMap[kind];
  if (row?.limit == null) return null;

  const overLimitByKind = {
    websites: usage.overLimitWebsites,
    apiKeys: usage.overLimitApiKeys,
    documents: usage.overLimitDocuments,
  };
  const overLimit = overLimitByKind[kind] || 0;
  const pct = Math.min(100, Math.round((row.used / row.limit) * 100));
  const atLimit = row.used >= row.limit;
  const overPlanLimit = overLimit > 0;
  const nearLimit = !atLimit && !overPlanLimit && pct >= 85;

  if (!atLimit && !nearLimit && !overPlanLimit) return null;

  const isAlert = atLimit || overPlanLimit;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${isAlert ? 'rgba(248,113,113,0.35)' : 'rgba(245,158,11,0.35)'}`,
        background: isAlert ? 'rgba(248,113,113,0.08)' : 'rgba(245,158,11,0.08)',
        fontSize: 13,
        lineHeight: 1.65,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <Zap size={16} style={{ flexShrink: 0, marginTop: 2, color: isAlert ? '#f87171' : 'var(--amber)' }} />
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>
          {overPlanLimit
            ? 'تجاوزت حد الباقة'
            : atLimit
              ? 'وصلت حد الباقة'
              : 'اقتربت من حد الباقة'}{' '}
          — {row.label}
        </strong>
        <span style={{ color: 'var(--text-2)' }}>
          {overPlanLimit && OVER_LIMIT_COPY[kind] ? (
            OVER_LIMIT_COPY[kind](usage, row, overLimit)
          ) : (
            <>
              باقة {usage.planLabel}: {row.used.toLocaleString('ar-SA')} /{' '}
              {row.limit.toLocaleString('ar-SA')}
              {atLimit && kind === 'websites' && ' — لا يمكن إضافة موقع جديد في هذه الباقة.'}
              {atLimit && kind === 'apiKeys' && ' — لا يمكن إنشاء مفتاح جديد في هذه الباقة.'}
            </>
          )}
        </span>
        {(atLimit || overPlanLimit) && (
          <Link to="/billing" className="btn btn-secondary btn-xs" style={{ marginTop: 10, display: 'inline-flex' }}>
            ترقية الباقة
          </Link>
        )}
      </div>
    </div>
  );
}
