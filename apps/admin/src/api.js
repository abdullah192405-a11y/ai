import { createApiClient } from '@wba/dashboard-ui/createApiClient';

const { auth, request, baseUrl } = createApiClient({
  tokenKey: 'wba_admin_token',
  userKey: 'wba_admin_user',
  authEventName: 'wba-admin-auth-updated',
  defaultTimeoutMs: 30000,
});

export { auth };

export const api = {
  baseUrl,
  login: (email, password) =>
    request('/v1/admin/auth/login', { method: 'POST', body: { email, password }, authed: false }),
  getTenants: () => request('/v1/admin/tenants'),
  createTenant: (payload) => request('/v1/admin/tenants', { method: 'POST', body: payload }),
  updateTenantStatus: (id, status) =>
    request(`/v1/admin/tenants/${id}/status`, { method: 'PATCH', body: { status } }),
  updateTenantPlan: (id, plan) =>
    request(`/v1/admin/tenants/${id}/plan`, { method: 'PATCH', body: { plan } }),
  getUsers: () => request('/v1/admin/users'),
  updateUserStatus: (id, status) =>
    request(`/v1/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  resetUserPassword: (id, password) =>
    request(`/v1/admin/users/${id}/password`, {
      method: 'PATCH',
      body: password ? { password } : {},
    }),
  getOverview: () => request('/v1/admin/overview'),
  getRevenue: () => request('/v1/admin/revenue'),
  getSystem: () => request('/v1/admin/system'),
  getAiModels: () => request('/v1/admin/ai-models'),
  getAiProviderKeys: () => request('/v1/admin/ai-models/keys'),
  updateAiProviderKeys: (payload) =>
    request('/v1/admin/ai-models/keys', { method: 'PATCH', body: payload }),
  getApiKeys: () => request('/v1/admin/api-keys'),
  updateApiKey: (id, payload) =>
    request(`/v1/admin/api-keys/${id}`, { method: 'PATCH', body: payload }),
  revokeApiKey: (id) =>
    request(`/v1/admin/api-keys/${id}/revoke`, { method: 'POST' }),
  rotateApiKey: (id) =>
    request(`/v1/admin/api-keys/${id}/rotate`, { method: 'POST' }),
  getCrawlJobs: () => request('/v1/admin/crawl-jobs'),
  getAuditLog: () => request('/v1/admin/audit-log'),
  getModeration: () => request('/v1/admin/moderation'),
  getSupport: () => request('/v1/admin/support'),
  getAnnouncements: () => request('/v1/admin/announcements'),
  getPlatformSettings: () => request('/v1/admin/settings'),
};
