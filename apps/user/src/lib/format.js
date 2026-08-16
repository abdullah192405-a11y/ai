import { PLAN_LABELS, ROLE_LABELS } from './constants';

export function initials(name, email) {
  const base = name || email || '?';
  return base
    .split(/[\s@]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function planLabel(plan) {
  return PLAN_LABELS[plan] || plan || '—';
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—';
}
