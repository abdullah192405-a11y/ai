/** Recharts tooltip styled for RTL Arabic dashboards. */
export default function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-4)',
        border: '1px solid var(--border-2)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: 'var(--shadow-md)',
        direction: 'rtl',
      }}
    >
      <div style={{ color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('ar-SA') : p.value}
        </div>
      ))}
    </div>
  );
}
