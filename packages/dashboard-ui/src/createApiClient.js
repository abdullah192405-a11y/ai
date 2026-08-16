const DEFAULT_BASE = 'http://localhost:8080';

/**
 * Shared fetch + localStorage auth for admin and user dashboards.
 */
export function createApiClient({
  baseUrl = import.meta.env.VITE_API_URL || DEFAULT_BASE,
  tokenKey,
  userKey,
  authEventName,
  defaultTimeoutMs = 30000,
} = {}) {
  const auth = {
    get token() {
      return localStorage.getItem(tokenKey) || '';
    },
    get user() {
      try {
        return JSON.parse(localStorage.getItem(userKey) || 'null');
      } catch {
        return null;
      }
    },
    set({ token, user }) {
      localStorage.setItem(tokenKey, token);
      localStorage.setItem(userKey, JSON.stringify(user));
      if (authEventName) window.dispatchEvent(new Event(authEventName));
    },
    clear() {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      if (authEventName) window.dispatchEvent(new Event(authEventName));
    },
    updateSession({ token, user }) {
      this.set({ token, user });
    },
  };

  async function fetchWithAuth(
    path,
    { method = 'GET', headers = {}, body, authed = true, timeoutMs = defaultTimeoutMs, signal } = {}
  ) {
    const reqHeaders = { ...headers };
    if (authed && auth.token) reqHeaders.Authorization = `Bearer ${auth.token}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);

    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: reqHeaders,
        body,
        signal: signal?.aborted ? signal : ctrl.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (signal?.aborted) throw new Error('aborted');
        throw new Error('انتهت مهلة الطلب — الزحف قد يستغرق عدة دقائق، حاول مرة أخرى');
      }
      throw new Error(`تعذر الاتصال بالخادم (${baseUrl}). شغّل: npm run dev:api`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (res.status === 401) {
      auth.clear();
      if (!path.includes('/auth/login')) window.location.reload();
    }

    return res;
  }

  async function parseJsonResponse(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `خطأ ${res.status}`);
      err.code = data.code;
      throw err;
    }
    return data;
  }

  async function request(
    path,
    { method = 'GET', body, authed = true, timeoutMs = defaultTimeoutMs, signal } = {}
  ) {
    const res = await fetchWithAuth(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      authed,
      timeoutMs,
      signal,
    });
    return parseJsonResponse(res);
  }

  /** POST multipart/form-data (no Content-Type — browser sets boundary). */
  async function upload(path, formData, { authed = true, timeoutMs = defaultTimeoutMs, signal } = {}) {
    const res = await fetchWithAuth(path, {
      method: 'POST',
      body: formData,
      authed,
      timeoutMs,
      signal,
    });
    return parseJsonResponse(res);
  }

  return { auth, request, upload, baseUrl };
}
