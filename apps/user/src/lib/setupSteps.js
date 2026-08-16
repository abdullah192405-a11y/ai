export const SETUP_STEPS = [
  {
    id: 'domain',
    path: '/setup/domain',
    label: 'موقعك',
    shortLabel: '١',
    description: 'أضف الموقع الذي تملكه، ثم أثبت الملكية بسجل DNS',
  },
  {
    id: 'knowledge',
    path: '/setup/knowledge',
    label: 'علّم المساعد',
    shortLabel: '٢',
    description: 'اجعل المساعد يعرف صفحاتك ومنتجاتك بزر واحد',
  },
  {
    id: 'api-key',
    path: '/setup/api-key',
    label: 'مفتاح الربط',
    shortLabel: '٣',
    description: 'مفتاح واحد يربط المساعد بموقعك — يظهر مرة واحدة فاحفظه',
  },
  {
    id: 'platform',
    path: '/setup/platform',
    label: 'تثبيت على الموقع',
    shortLabel: '٤',
    description: 'اختر منصتك (سلة، زد، ووردبريس…) واتبع الخطوات بالتفصيل',
  },
  {
    id: 'customize',
    path: '/setup/customize',
    label: 'شكل المساعد',
    shortLabel: '٥',
    description: 'اللون، الاسم، ورسالة الترحيب — كما سيراها الزائر',
  },
];

export const PLATFORM_STORAGE_KEY = 'wba_embed_platform';
export const EMBED_KEY_STORAGE = 'wba_embed_api_key_temp';

export function rememberEmbedKey(key, websiteId) {
  if (!key) return;
  try {
    sessionStorage.setItem(
      EMBED_KEY_STORAGE,
      JSON.stringify({ key, websiteId: websiteId || null })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function getRememberedEmbedKey(websiteId) {
  try {
    const raw = sessionStorage.getItem(EMBED_KEY_STORAGE);
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.key) {
        if (websiteId && parsed.websiteId && parsed.websiteId !== websiteId) return '';
        return parsed.key;
      }
    } catch {
      return websiteId ? raw : raw;
    }
    return typeof raw === 'string' ? raw : '';
  } catch {
    return '';
  }
}

export function getStepByPath(pathname) {
  return SETUP_STEPS.find((s) => pathname.startsWith(s.path)) || SETUP_STEPS[0];
}

export function getStepIndex(stepId) {
  return SETUP_STEPS.findIndex((s) => s.id === stepId);
}

export function getNextStep(stepId) {
  const idx = getStepIndex(stepId);
  return idx >= 0 && idx < SETUP_STEPS.length - 1 ? SETUP_STEPS[idx + 1] : null;
}

export function getPrevStep(stepId) {
  const idx = getStepIndex(stepId);
  return idx > 0 ? SETUP_STEPS[idx - 1] : null;
}

export function getFirstIncompleteStep(progress) {
  if (!progress.hasVerifiedDomain) return SETUP_STEPS[0];
  if (!progress.hasKnowledge) return SETUP_STEPS[1];
  if (!progress.hasApiKey) return SETUP_STEPS[2];
  if (!progress.hasPlatform) return SETUP_STEPS[3];
  return SETUP_STEPS[4];
}

export function isSetupComplete(progress) {
  return (
    progress.hasVerifiedDomain
    && progress.hasKnowledge
    && progress.hasApiKey
    && progress.hasPlatform
  );
}
