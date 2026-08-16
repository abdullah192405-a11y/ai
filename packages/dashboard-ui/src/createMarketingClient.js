const DEFAULT_BASE = 'http://localhost:8080';

/**
 * Unauthenticated API client for the marketing website (signup, public plans).
 */
export function createMarketingClient({
  baseUrl = import.meta.env.VITE_API_URL || DEFAULT_BASE,
} = {}) {
  async function request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error(`تعذر الاتصال بالخادم. تأكد من تشغيل npm run dev:api`);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `خطأ ${res.status}`);
    }
    return data;
  }

  return {
    baseUrl,
    signup: (payload) => request('/v1/auth/signup', { method: 'POST', body: payload }),
    getPlans: () => request('/v1/plans'),
  };
}
