import { validateNavigateActions } from './routes.js';

const MARKER = '\nACTIONS_JSON:';
const MARKER_RE = /\n?\s*ACTIONS_JSON\s*:?\s*/i;
const MARKER_TAIL = 'ACTIONS_JSON';

export { MARKER };

function markerIndex(fullText) {
  const m = String(fullText || '').match(MARKER_RE);
  return m ? m.index : -1;
}

export function stripActionsMarker(fullText) {
  const idx = markerIndex(fullText);
  if (idx === -1) return String(fullText || '').trim();
  return fullText.slice(0, idx).trim();
}

/** Hold back streaming tokens that might be the start of ACTIONS_JSON. */
export function streamVisibleEnd(fullText, sentLen) {
  const full = String(fullText || '');
  const at = markerIndex(full);
  if (at !== -1) {
    if (sentLen < at) return { delta: full.slice(sentLen, at), sentLen: at };
    return { delta: '', sentLen };
  }

  let end = full.length;
  for (let i = 1; i <= MARKER_TAIL.length + 2; i++) {
    const tail = full.slice(-i);
    if (
      MARKER_TAIL.startsWith(tail) ||
      `\n${MARKER_TAIL}`.startsWith(tail) ||
      `\n${MARKER_TAIL}:`.startsWith(tail)
    ) {
      end = full.length - i;
      break;
    }
  }

  if (end > sentLen) return { delta: full.slice(sentLen, end), sentLen: end };
  return { delta: '', sentLen };
}

export function parseActions(fullText, options = {}) {
  const idx = markerIndex(fullText);
  if (idx === -1) return { text: stripActionsMarker(fullText), actions: [] };

  const text = fullText.slice(0, idx).trim();
  const jsonPart = fullText.slice(idx).replace(MARKER_RE, '').trim();

  try {
    const parsed = JSON.parse(jsonPart);
    const actions = sanitizeActions(Array.isArray(parsed) ? parsed : [], options);
    return { text, actions };
  } catch {
    return { text, actions: [] };
  }
}

function sanitizeActions(actions, options = {}) {
  const { validateNavigate } = options;

  let out = actions
    .filter((a) => a && typeof a === 'object' && a.type === 'navigate' && a.url)
    .slice(0, 4)
    .map((a) => ({
      type: 'navigate',
      url: String(a.url).startsWith('/') ? a.url : `/${String(a.url).replace(/^\//, '')}`,
      label: String(a.label || a.url).slice(0, 80),
    }));

  if (validateNavigate && out.length) {
    out = validateNavigate(out);
  }

  return out;
}

export const CHAT_ACTION_INSTRUCTIONS = `
عندما يسأل المستخدم عن صفحة أو مسار أو يريد الذهاب لقسم:
1. راجع قائمة المسارات المتاحة (✓) في قاعدة المعرفة.
2. أجب من المحتوى المرفق بوضوح.
3. اقترح أزرار تنقل فقط عندما يطلب المستخدم التنقل أو عند وجود مسار ✓ واضح يناسب السؤال.
4. للإجابات النصية العامة (شرح، ترحيب، قائمة معلومات) لا تضف ACTIONS_JSON.
5. عند الحاجة، في سطر منفصل في النهاية (لا يظهر للمستخدم) أضف:
ACTIONS_JSON:[{"type":"navigate","url":"/المسار","label":"وصف الزر"}]
(حتى 4 أزرار navigate عند عدة نتائج/صفحات مميزة)

قواعد:
- url يبدأ بـ / ويجب أن يكون من قائمة مسارات هذا الموقع ✓ فقط
- لا تخترع مسارات — كل موقع له بنية مختلفة
- JSON صالح فقط، بدون markdown
- إذا لا مسار متاح يناسب السؤال، لا تضف ACTIONS_JSON
`.trim();

export function getActionInstructions() {
  return CHAT_ACTION_INSTRUCTIONS;
}
