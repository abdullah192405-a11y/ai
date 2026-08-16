import { getActionInstructions } from './knowledge/actions.js';
import { formatRouteMapForPrompt, isRouteQuestion, routeSystemInstructions } from './knowledge/routes.js';
import {
  contentSearchSystemInstructions,
  isContentSearchQuestion,
  needsCatalogSearch,
  isPricingQuestion,
} from './knowledge/contentSearch.js';
import { RESPONSE_STYLE_RULES } from './knowledge/responseStyle.js';

export function buildSystemInstruction(config, knowledgeContext, routeContext, { question } = {}) {
  const parts = [config.systemPrompt];

  if (routeContext) {
    parts.push('\n\n', routeContext);
  }

  if (knowledgeContext) {
    parts.push('\n\n--- محتوى الموقع (قاعدة المعرفة) ---\n', knowledgeContext);
  }

  const q = String(question || '');
  const searchMode = isContentSearchQuestion(q) || needsCatalogSearch(q);
  const routeMode = isRouteQuestion(q);

  if (searchMode) {
    parts.push('\n\n', contentSearchSystemInstructions());
  }
  if (routeMode) {
    parts.push('\n\n', routeSystemInstructions());
  }
  if (searchMode || routeMode) {
    parts.push('\n\n', RESPONSE_STYLE_RULES);
  }

  parts.push('\n\n', getActionInstructions());
  return parts.join('');
}

export function buildChatMessages({ question, history, config, knowledgeContext, routeContext }) {
  const system = buildSystemInstruction(config, knowledgeContext, routeContext, { question });
  const messages = [{ role: 'system', content: system }];

  for (const turn of history || []) {
    if (!turn?.content) continue;
    messages.push({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: String(turn.content),
    });
  }

  messages.push({ role: 'user', content: String(question) });

  return messages;
}

export function routeAwareTemperature(config, question) {
  if (
    isRouteQuestion(question) ||
    isContentSearchQuestion(question) ||
    needsCatalogSearch(question) ||
    isPricingQuestion(question)
  ) {
    return Math.min(typeof config.temperature === 'number' ? config.temperature : 0.7, 0.35);
  }
  return typeof config.temperature === 'number' ? config.temperature : 0.7;
}

export { isRouteQuestion };
