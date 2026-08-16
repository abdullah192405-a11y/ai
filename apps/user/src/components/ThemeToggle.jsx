import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle({ compact = false, embedded = false }) {
  const { isLight, setTheme } = useTheme();
  const showLabel = !compact;

  return (
    <div
      className="theme-toggle-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'space-between',
        gap: 10,
        padding: compact || embedded ? 0 : '10px 14px',
        marginBottom: compact || embedded ? 0 : 8,
        borderRadius: compact || embedded ? 0 : 'var(--radius-sm)',
        background: compact || embedded ? 'transparent' : 'var(--bg-3)',
        border: compact || embedded ? 'none' : '1px solid var(--border-1)',
      }}
    >
      {showLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {isLight ? (
            <Sun size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          ) : (
            <Moon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
              {isLight ? 'الوضع الفاتح' : 'الوضع الداكن'}
            </strong>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {isLight ? 'مظهر مشرق للوحة التحكم' : 'مظهر داكن للوحة التحكم'}
            </span>
          </div>
        </div>
      )}
      <label
        className="toggle"
        title={isLight ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح'}
        aria-label={isLight ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح'}
      >
        <input
          type="checkbox"
          checked={isLight}
          onChange={(e) => setTheme(e.target.checked ? 'light' : 'dark')}
        />
        <span className="toggle-track" />
      </label>
    </div>
  );
}
