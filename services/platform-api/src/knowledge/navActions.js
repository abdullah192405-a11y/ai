import { validateNavigateActions } from './routes.js';
import { decodePath } from './groundedAnswer.js';

/** Keep only valid navigate actions for chat link buttons. */
export function finalizeAssistantActions(actions, routes, { max = 4 } = {}) {
  if (!Array.isArray(actions) || !actions.length) return [];

  const normalized = actions
    .filter((a) => a && a.type === 'navigate' && a.url)
    .map((a) => ({
      type: 'navigate',
      url: String(a.url).startsWith('/') ? a.url : `/${String(a.url).replace(/^\//, '')}`,
      label: String(a.label || a.url).slice(0, 80),
    }));

  return validateNavigateActions(normalized, routes).slice(0, max);
}

export function navActionsFromTargets(targets, routes) {
  if (!targets?.length) return [];
  return finalizeAssistantActions(
    targets.map((picked) => ({
      type: 'navigate',
      url: decodePath(picked.path),
      label: picked.label || picked.title || 'عرض المحتوى',
    })),
    routes
  );
}
