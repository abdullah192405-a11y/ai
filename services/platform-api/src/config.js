import 'dotenv/config';
import {
  DEFAULT_WIDGET_PUBLIC,
  SERVER_ONLY_WIDGET_KEYS,
} from '@wba/widget-config';

export const env = {
  port: parseInt(process.env.PORT || '8080', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://wba_admin:wba_dev_password@localhost:5432/wba_platform',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash-lite',
  // OpenAI-compatible fallback (OpenAI, Groq, etc.)
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '',
  openaiApiBase:
    process.env.OPENAI_API_BASE ||
    (process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'),
  openaiModel:
    process.env.OPENAI_MODEL ||
    (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@acme-corp.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8080',
  groqApiKey: process.env.GROQ_API_KEY || '',
  // groq | gemini | auto (auto = Groq first when GROQ_API_KEY is set)
  aiProvider: process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini'),
  defaultAiModel:
    process.env.GROQ_API_KEY && (process.env.AI_PROVIDER || 'groq') !== 'gemini'
      ? process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile'
      : process.env.DEFAULT_MODEL || 'gemini-2.5-flash-lite',
};

// Default widget + bot configuration. Stored per-website in websites.settings.
export const DEFAULT_CONFIG = {
  ...DEFAULT_WIDGET_PUBLIC,
  systemPrompt:
    'أنت مساعد ذكي لموقع ويب. كل موقع له مسارات (routes) مختلفة — راجع قائمة المسارات المكتشفة ✓ في السياق ولا تخترع مسارات. استخدم: (1) بيانات API/قاعدة البيانات، (2) النص الحي من الصفحة، (3) الصفحات المفهرسة. عند البحث: ابحث في كل المصادر واذكر النتائج بالاسم. للتنقل استخدم فقط مسارات ✓ من قائمة هذا الموقع.',
  model: env.defaultAiModel,
  temperature: 0.7,
  maxTurns: 20,
  knowledgeBaseUrl: 'http://localhost:8081',
  siteKnowledge: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
};

export const SERVER_ONLY_KEYS = SERVER_ONLY_WIDGET_KEYS;

export function publicConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...(config || {}) };
  const out = {};
  for (const key of Object.keys(merged)) {
    if (!SERVER_ONLY_KEYS.includes(key)) out[key] = merged[key];
  }
  return out;
}

export function fullConfig(config) {
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}

export function isSupabaseConfigured(config) {
  const c = fullConfig(config);
  return Boolean(String(c.supabaseUrl || '').trim() && String(c.supabaseAnonKey || '').trim());
}
