/**
 * Cross-app auth handoff (marketing site → user dashboard).
 * Different ports/origins pass JWT via URL hash.
 */

export function buildAuthHandoffUrl({ userAppUrl, token, user }) {
  const hash = new URLSearchParams({
    wba_token: token,
    wba_user: JSON.stringify(user),
  }).toString();
  return `${userAppUrl.replace(/\/$/, '')}/#${hash}`;
}

/** @param {{ set: (session: { token: string, user: object }) => void }} auth */
export function consumeAuthHandoff(auth) {
  const hash = window.location.hash.slice(1);
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const token = params.get('wba_token');
  const userRaw = params.get('wba_user');
  if (!token || !userRaw) return false;

  try {
    const user = JSON.parse(userRaw);
    auth.set({ token, user });
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  } catch {
    return false;
  }
}
