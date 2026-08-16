/** Arabic locale date formatting shared across platform-api routes. */
export function formatDateAr(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
