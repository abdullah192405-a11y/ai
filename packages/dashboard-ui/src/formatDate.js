/** Arabic locale date formatting for dashboard tables. */
export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
