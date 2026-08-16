import { createApiClient } from '@wba/dashboard-ui/createApiClient';

export const { auth, request, upload, baseUrl } = createApiClient({
  tokenKey: 'wba_token',
  userKey: 'wba_user',
  authEventName: 'wba-auth-updated',
});

export const coreApi = {
  login: (email, password) =>
    request('/v1/auth/login', { method: 'POST', body: { email, password }, authed: false }),
  getProfile: () => request('/v1/me/profile'),
  getUsage: () => request('/v1/me/usage'),
  changePlan: (plan) => request('/v1/me/plan', { method: 'PATCH', body: { plan } }),
  getOverview: () => request('/v1/me/overview'),
  getAnalytics: (period = '30d') =>
    request(`/v1/me/analytics?period=${encodeURIComponent(period)}`),
  getSettings: () => request('/v1/me/settings'),
  updateSettings: (body) => request('/v1/me/settings', { method: 'PATCH', body }),
  changePassword: (currentPassword, newPassword) =>
    request('/v1/me/password', { method: 'PATCH', body: { currentPassword, newPassword } }),
  getWebsites: () => request('/v1/me/websites'),
  createWebsite: (payload) => request('/v1/me/websites', { method: 'POST', body: payload }),
  updateWebsite: (id, payload) => request(`/v1/me/websites/${id}`, { method: 'PATCH', body: payload }),
  selectWebsite: (id) => request(`/v1/me/websites/${id}/select`, { method: 'POST' }),
  setWebsiteWidget: (id, enabled) =>
    request(`/v1/me/websites/${id}/widget`, { method: 'PATCH', body: { enabled } }),
  refreshWebsite: (id) => request(`/v1/me/websites/${id}/refresh`, { method: 'POST' }),
  getConfig: () => request('/v1/me/config'),
  saveConfig: (config) => request('/v1/me/config', { method: 'PUT', body: config }),
  getKeys: () => request('/v1/me/keys'),
  createKey: (name, scopes) =>
    request('/v1/me/keys', { method: 'POST', body: { name, scopes } }),
  revokeKey: (id) => request(`/v1/me/keys/${id}`, { method: 'DELETE' }),
  getConversations: () => request('/v1/me/conversations'),
  getConversationMessages: (sessionId) => request(`/v1/me/conversations/${sessionId}/messages`),
  getKnowledgePages: () => request('/v1/me/knowledge/pages'),
  getPageDetails: (id) => request(`/v1/me/knowledge/pages/${id}`),
  setPageAiVisibility: (id, excluded_from_ai) =>
    request(`/v1/me/knowledge/pages/${id}`, { method: 'PATCH', body: { excluded_from_ai } }),
  setBatchPagesAiVisibility: (pageIds, excluded_from_ai) =>
    request('/v1/me/knowledge/pages/batch-visibility', {
      method: 'PATCH',
      body: { pageIds, excluded_from_ai },
    }),
  getKnowledgeDocuments: () => request('/v1/me/knowledge/documents'),
  setDocumentAiVisibility: (id, excluded_from_ai) =>
    request(`/v1/me/knowledge/documents/${id}`, {
      method: 'PATCH',
      body: { excluded_from_ai },
    }),
  deleteKnowledgeDocument: (id) =>
    request(`/v1/me/knowledge/documents/${id}`, { method: 'DELETE' }),
  getDocumentExtract: (id) => request(`/v1/me/knowledge/documents/${id}/extract`),
  getSupabaseStatus: () => request('/v1/me/knowledge/supabase'),
  testRagQuery: (question) =>
    request('/v1/me/knowledge/test-rag', { method: 'POST', body: { question } }),
};
