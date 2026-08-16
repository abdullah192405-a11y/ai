import { env } from './config.js';
import { getAiProviderMode } from './services/platformConfig.js';
import { geminiConfigured, streamGeminiAnswer } from './gemini.js';
import { groqConfigured, streamGroqAnswer } from './openai.js';

export function aiConfigured() {
  return groqConfigured() || geminiConfigured();
}

function isGeminiModel(model) {
  return String(model || '').toLowerCase().startsWith('gemini');
}

function isGroqModel(model) {
  const m = String(model || '').toLowerCase();
  return (
    m.startsWith('llama') ||
    m.startsWith('mixtral') ||
    m.startsWith('gemma') ||
    m.startsWith('gpt-')
  );
}

/** Tenant model in Customize picks the provider (Gemini vs Groq). */
function providerOrderForRequest(config) {
  const model = config?.model;
  if (isGeminiModel(model)) {
    return geminiConfigured() ? ['gemini'] : groqConfigured() ? ['groq'] : [];
  }
  if (isGroqModel(model)) {
    return groqConfigured() ? ['groq'] : geminiConfigured() ? ['gemini'] : [];
  }

  const mode = getAiProviderMode();
  if (mode === 'groq') return groqConfigured() ? ['groq'] : geminiConfigured() ? ['gemini'] : [];
  if (mode === 'gemini') return geminiConfigured() ? ['gemini'] : groqConfigured() ? ['groq'] : [];
  return groqConfigured() ? ['groq', 'gemini'] : ['gemini', 'groq'];
}

async function runProvider(name, params, onToken) {
  if (name === 'groq') return streamGroqAnswer(params, onToken);
  return streamGeminiAnswer(params, onToken);
}

function isConfigured(name) {
  return name === 'groq' ? groqConfigured() : geminiConfigured();
}

export async function streamAnswer(params, onToken) {
  const order = providerOrderForRequest(params.config).filter(isConfigured);
  if (!order.length) {
    throw new Error('No AI provider configured (set GROQ_API_KEY or GEMINI_API_KEY in server/.env)');
  }

  const errors = [];
  for (let i = 0; i < order.length; i++) {
    const name = order[i];
    try {
      return await runProvider(name, params, onToken);
    } catch (err) {
      errors.push(`${name}: ${err.message?.slice(0, 160)}`);
      console.error(`[llm] ${name} failed:`, err.message?.slice(0, 200));
      if (i === order.length - 1) break;
    }
  }

  throw new Error(errors.join(' | ') || 'All AI providers failed');
}

export { geminiConfigured } from './gemini.js';
export { groqConfigured, openaiConfigured, completeGroqOnce } from './openai.js';

export async function completeOnce({ system, user, maxTokens = 4096, temperature = 0.2 }) {
  const { completeGroqOnce } = await import('./openai.js');
  const { completeGeminiOnce, geminiConfigured } = await import('./gemini.js');

  const errors = [];
  if (groqConfigured()) {
    try {
      return await completeGroqOnce({ system, user, maxTokens, temperature });
    } catch (err) {
      errors.push(`groq: ${err.message}`);
    }
  }
  if (geminiConfigured()) {
    try {
      return await completeGeminiOnce({ system, user, maxTokens, temperature });
    } catch (err) {
      errors.push(`gemini: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'No AI provider configured');
}

export function userFacingAiError(err) {
  const m = err?.message || '';

  if (m.includes('429') || m.includes('quota') || m.includes('Quota exceeded') || m.includes('Rate limit')) {
    if (m.includes('Groq') || env.aiProvider === 'groq') {
      return 'تعذّر استخدام Groq: تم تجاوز الحصة أو حد الطلبات. انتظر قليلاً أو جرّب نموذج llama-3.1-8b-instant.';
    }
    const alt = groqConfigured() && env.aiProvider === 'gemini'
      ? '\n\n💡 عيّن AI_PROVIDER=groq في server/.env لاستخدام Groq كمزود أساسي.'
      : '';
    return 'تعذّر استخدام الذكاء الاصطناعي: تم تجاوز حصة API.' + alt;
  }
  if (m.includes('413') || m.includes('Request too large')) {
    if (m.includes('8b') || m.includes('instant') || m.includes('TPM')) {
      return 'السياق كبير جداً لهذا النموذج. جرّب نموذج llama-3.3-70b-versatile من صفحة التخصيص، أو اسأل سؤالاً أكثر تحديداً.';
    }
    return 'السياق كبير جداً. اسأل سؤالاً أكثر تحديداً أو جرّب نموذجاً أكبر.';
  }
  if (m.includes('503') || m.includes('high demand')) {
    return 'خدمة AI مشغولة حالياً. حاول مرة أخرى بعد دقيقة.';
  }
  if (m.includes('404') && m.includes('models/')) {
    return 'نموذج AI غير متاح. تحقق من DEFAULT_MODEL أو OPENAI_MODEL في server/.env';
  }
  if (!groqConfigured() && !geminiConfigured()) {
    return 'لم يتم ضبط مفتاح AI على الخادم. أضف GROQ_API_KEY أو GEMINI_API_KEY في server/.env';
  }
  if (m.includes('401') || m.includes('403') || m.includes('invalid') || m.includes('API key')) {
    return 'مفتاح AI غير صالح. تحقق من GROQ_API_KEY أو GEMINI_API_KEY في server/.env';
  }
  return `عذراً، تعذّر تحليل سؤالك بالذكاء الاصطناعي. (${m.slice(0, 120)})`;
}
