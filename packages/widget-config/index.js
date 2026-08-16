/** Shared widget appearance defaults for API and dashboard apps. */

export const PRESET_COLORS = [
  '#006c35', '#0a8244', '#004d26', '#1a9a52', '#22c55e',
  '#f97316', '#f59e0b', '#84cc16', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#1e293b', '#0f172a',
];

export const WIDGET_POSITIONS = [
  { id: 'bottom-left', label: 'أسفل اليسار' },
  { id: 'bottom-right', label: 'أسفل اليمين' },
  { id: 'top-left', label: 'أعلى اليسار' },
  { id: 'top-right', label: 'أعلى اليمين' },
];

/** Arabic-friendly font presets for the embedded widget. */
export const FONT_OPTIONS = [
  {
    id: 'ibm-plex-arabic',
    label: 'IBM Plex Sans Arabic',
    stack: '"IBM Plex Sans Arabic","Inter",-apple-system,BlinkMacSystemFont,sans-serif',
    google: 'IBM+Plex+Sans+Arabic:wght@300;400;500;600;700',
  },
  {
    id: 'cairo',
    label: 'Cairo',
    stack: '"Cairo",sans-serif',
    google: 'Cairo:wght@300;400;500;600;700;800;900',
  },
  {
    id: 'tajawal',
    label: 'Tajawal',
    stack: '"Tajawal",sans-serif',
    google: 'Tajawal:wght@300;400;500;700;800',
  },
  {
    id: 'noto-sans-arabic',
    label: 'Noto Sans Arabic',
    stack: '"Noto Sans Arabic",sans-serif',
    google: 'Noto+Sans+Arabic:wght@300;400;500;600;700',
  },
  {
    id: 'almarai',
    label: 'Almarai',
    stack: '"Almarai",sans-serif',
    google: 'Almarai:wght@300;400;700;800',
  },
];

export function resolveFontOption(fontFamilyId) {
  return FONT_OPTIONS.find((f) => f.id === fontFamilyId) || FONT_OPTIONS[0];
}

export function googleFontStylesheetUrl(fontFamilyId) {
  const font = resolveFontOption(fontFamilyId);
  return `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
}

/** Fixed chat shell — only typography scales, not the window chrome. */
export const WIDGET_SHELL = {
  width: 380,
  height: 560,
};

export function widgetTextScale(baseFontSize) {
  const size = Number(baseFontSize);
  return (Number.isFinite(size) && size > 0 ? size : 14) / 14;
}

/** Fields safe to expose in the browser widget and dashboard preview. */
export const DEFAULT_WIDGET_PUBLIC = {
  color: '#006c35',
  theme: 'light',
  position: 'bottom-left',
  radius: 16,
  fontFamily: 'ibm-plex-arabic',
  baseFontSize: 14,
  showBranding: true,
  botName: 'المساعد الذكي',
  botSubtitle: 'متصل الآن',
  welcomeMessage: 'مرحباً! 👋 أنا مساعدك الذكي. كيف أقدر أساعدك اليوم؟',
  placeholder: 'اسأل أي سؤال...',
  suggestedQuestions: ['كيف أبدأ؟', 'أين أجد المحتوى التعليمي؟', 'من هم شركاء النجاح؟'],
  autoOpen: false,
  autoOpenDelay: 5,
  soundEnabled: true,
  language: 'ar',
};

/** Keys never sent to the public widget endpoint. */
export const SERVER_ONLY_WIDGET_KEYS = [
  'systemPrompt',
  'model',
  'temperature',
  'maxTurns',
  'knowledgeBaseUrl',
  'siteKnowledge',
  'supabaseUrl',
  'supabaseAnonKey',
];

/** Dashboard editor defaults (includes server fields as empty strings). */
export const DEFAULT_WIDGET_EDITOR = {
  ...DEFAULT_WIDGET_PUBLIC,
  suggestedQuestions: [],
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTurns: 20,
  knowledgeBaseUrl: '',
  systemPrompt: '',
};

export function normalizeWidgetConfig(raw, defaults = DEFAULT_WIDGET_EDITOR) {
  const c = raw || {};
  return {
    ...defaults,
    ...c,
    suggestedQuestions: Array.isArray(c.suggestedQuestions)
      ? c.suggestedQuestions
      : defaults.suggestedQuestions,
  };
}
