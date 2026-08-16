// Build a factual answer block from search results so the LLM cannot ignore DB matches.

import { isGradesByTopicQuestion } from './gradesByTopic.js';

export function decodePath(path) {
  if (!path) return '';
  try {
    return decodeURIComponent(String(path));
  } catch {
    return String(path);
  }
}

export function buildGroundedSearchBlock({ question, result }) {
  if (!result?.matches?.length) {
    if (!result?.snippets?.length) return '';
    return [
      '=== حقائق من الصفحة الحية (استخدمها في ردك) ===',
      ...result.snippets.slice(0, 2).map((s) => `- ${s.text.slice(0, 160)}`),
      '',
    ].join('\n');
  }

  const carMatches = result.matches.filter((m) => m.type === 'car');
  if (carMatches.length > 1) {
    const names = carMatches.slice(0, 5).map((m) => m.title).join('، ');
    return [
      '=== إجابة مؤكدة من قاعدة البيانات ===',
      `سؤال المستخدم: ${question}`,
      `✓ وُجد ${carMatches.length}+ سيارة مطابقة، منها: ${names}`,
      'لخص للمستخدم بعدد تقريبي و3–5 أسماء — بدون مسارات خام.',
      'زر تنقل واحد لـ /cars أو أقرب مسار ✓.',
      '',
    ].join('\n');
  }

  const top = result.matches[0];
  const lines = [
    '=== إجابة مؤكدة من قاعدة البيانات (يجب بناء ردك عليها — لا تناقضها ولا تقل "لا توجد نتائج") ===',
    `سؤال المستخدم: ${question}`,
    `✓ وُجد: "${top.title}"`,
  ];

  if (top.description) lines.push(`الوصف: ${top.description.slice(0, 200)}`);
  if (top.grade) lines.push(`تابع لـ: ${top.grade}`);
  if (top.subject) lines.push(`المادة: ${top.subject}`);
  if (top.path) lines.push(`مسار التنقل: ${decodePath(top.path)}`);

  if (result.matches.length > 1) {
    lines.push(
      'نتائج أخرى:',
      ...result.matches.slice(1, 4).map((m) => `- ${m.title}${m.path ? ` → ${decodePath(m.path)}` : ''}`)
    );
  }

  lines.push(
    '',
    'تعليمات: اذكر الاسم بالضبط كما أعلاه. اقترح زر تنقل للمسار إن وُجد. لا تذكر مسارات غير موجودة في قائمة ✓.'
  );

  return lines.join('\n');
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
}

function cleanDescription(description) {
  return String(description || '')
    .replace(/\[محتوى عام من قاعدة البيانات[^\]]*\]/g, '')
    .replace(/\[محتوى من Supabase[^\]]*\]/g, '')
    .replace(/(?:مسار الصفحة|عنوان الصفحة|og:description|الوصف):\s*[^\n]*/gi, '')
    .replace(/^(?:العنوان|التفاصيل|الوصف):\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** Deterministic search answer from real matches — avoids LLM hallucination. */
export function composeSearchAnswer({ question, result }) {
  const matches = (result?.matches || []).filter((m) => (m.score || 0) > 0);
  if (!matches.length) return null;

  const seen = new Set();
  const unique = matches.filter((m) => {
    const k = cleanTitle(m.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const top = unique.slice(0, 5);
  const intro =
    top.length === 1
      ? `وجدت موضوعاً يطابق بحثك:`
      : `وجدت ${unique.length} موضوع/محتوى متعلق ببحثك، منها:`;

  const lines = [intro, ''];
  for (const m of top) {
    const title = cleanTitle(m.title);
    const desc = m.description ? cleanDescription(m.description) : '';
    lines.push(`• ${title}${desc ? ` — ${desc}` : ''}`);
  }

  if (unique.length > top.length) {
    lines.push('', `(و${unique.length - top.length} نتيجة إضافية)`);
  }

  return lines.join('\n');
}

export function shouldUseComposedSearchAnswer({ question, result }) {
  if (isGradesByTopicQuestion(question)) return false;
  if (!result?.matches?.length) return false;
  if ((result.matches[0]?.score || 0) < 3) return false;
  if (/(?:ابحث|بحث|find|search)\s+(?:عن|about|for)/iu.test(String(question || ''))) {
    return true;
  }
  return false;
}
