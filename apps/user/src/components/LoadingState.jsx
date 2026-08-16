import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'جاري التحميل...' }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
      <Loader2 size={28} className="spin" style={{ margin: '0 auto 12px' }} />
      {message}
    </div>
  );
}
