// Offline answers when Gemini is unavailable — short, relevant snippets only.

const MAX_SNIPPET = 220;
const MAX_SNIPPETS = 2;
const MAX_TOTAL = 480;

const STOP = new Set([
  'ما', 'ماهو', 'ماهي', 'من', 'هل', 'عن', 'في', 'على', 'إلى', 'الى', 'هذا', 'هذه',
  'that', 'the', 'what', 'who', 'how', 'where', 'when', 'why', 'is', 'are',
  'اسم', 'name', 'موقع', 'الموقع', 'منصة', 'المنصة', 'platform', 'site', 'app',
]);

function normalizeArabic(w) {
  return w.replace(/^ال/, '').replace(/[ًٌٍَُِّْ]/g, '');
}

function terms(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[\s,.;:!?،؟]+/)
    .map((w) => normalizeArabic(w))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function isGreeting(question) {
  const t = question.trim().replace(/[!?.؟،]/g, '');
  return /^(مرحبا|مرحباً|hello|hi|hey|السلام|سلام|اهلا|أهلا|أهلاً|هاي|صباح|مساء|الو)$/iu.test(t);
}

export function isVague(question) {
  const t = terms(question);
  return t.length === 0 || (t.length === 1 && isGreeting(question));
}

/** Greetings and other zero-term chit-chat — skip heavy LLM context. */
export function isSimpleQuery(question) {
  return isGreeting(question) || isVague(question);
}

function isIdentityQuestion(question) {
  const q = question.toLowerCase().replace(/[؟?!.]/g, '').trim();
  return (
    /(?:ما|ماهو|ماهي|وش|ايش|what)\s*(?:هو|هي|is)?\s*(?:اسم|name)\s*(?:ال)?(?:موقع|منصة|تطبيق|platform|site|app)/u.test(q) ||
    /(?:اسم|name)\s*(?:ال)?(?:موقع|منصة|تطبيق|platform|site)/u.test(q) ||
    /(?:ما|ماهي|what)\s*(?:هي|is)\s*(?:ال)?(?:منصة|موقع|platform|site)/u.test(q) ||
    /^(?:من\s+انت|من\s+أنت|who\s+are\s+you)$/iu.test(q) ||
    /^(?:عن\s+(?:ال)?(?:منصة|موقع)|about\s+(?:the\s+)?(?:site|platform))/iu.test(q)
  );
}

function parseSiteProfile(siteKnowledge, livePageContext, pages) {
  const text = String(siteKnowledge || '').trim();
  const profile = { name: '', tagline: '', summary: '', paths: [], faqLines: [] };

  if (text) {
    const blocks = text.split(/\n\n+/);
    const first = blocks[0] || '';
    const dash = first.match(/^(.+?)\s*[—\-–]\s*(.+)$/);
    if (dash) {
      profile.name = dash[1].trim();
      profile.tagline = dash[2].trim();
    } else {
      profile.name = first.split('\n')[0].trim();
    }
    profile.summary = blocks.slice(0, 2).join(' ').trim();

    for (const line of text.split('\n')) {
      const path = line.match(/^-\s*(\/[a-zA-Z0-9/_-]+)\s*[—\-–:]\s*(.+)$/);
      if (path) profile.paths.push({ path: path[1], label: path[2].trim() });
      else if (line.includes(':') && line.length > 20 && !line.startsWith('-')) {
        profile.faqLines.push(line.trim());
      }
    }
  }

  if (!profile.name && livePageContext?.title) {
    profile.name = livePageContext.title.split(/[|\-–—]/)[0].trim();
  }
  if (!profile.tagline && livePageContext?.description) {
    profile.tagline = livePageContext.description.trim();
  }
  if (!profile.name && pages?.length) {
    const home = pages.find((p) => p.path === '/' || p.path === '') || pages[0];
    if (home?.title) profile.name = home.title.trim();
  }

  if (profile.name.includes('Lab4') || profile.name.includes('المختبر')) {
    profile.displayName = 'المختبر الرابع (Lab4)';
  } else if (profile.name) {
    profile.displayName = profile.name;
  } else {
    profile.displayName = 'الموقع';
  }

  return profile;
}

function identityReply(profile) {
  const parts = [];
  if (profile.displayName && profile.displayName !== 'الموقع') {
    parts.push(`اسم المنصة هو **${profile.displayName}**.`);
  } else {
    parts.push('اسم المنصة غير محدد في الإعدادات بعد.');
  }
  if (profile.tagline) parts.push(profile.tagline);
  else if (profile.summary && profile.summary.length < 300) parts.push(profile.summary);

  return { text: parts.join('\n\n'), actions: [] };
}

function chunkText(text) {
  if (!text) return [];
  return String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?؟])\s+|(?=\s+[—\-–])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 800);
}

function structuredChunks(siteKnowledge, pages) {
  const chunks = [];
  const text = String(siteKnowledge || '').trim();

  if (text) {
    for (const block of text.split(/\n\n+/)) {
      const trimmed = block.trim();
      if (trimmed.length > 10) chunks.push(trimmed);
    }
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (t.startsWith('- ') && t.length > 10) chunks.push(t);
    }
  }

  for (const p of pages || []) {
    const head = `${p.path} — ${p.title || ''}`.trim();
    if (head.length > 5) chunks.push(head);
    chunks.push(...chunkText(p.content).slice(0, 3));
  }

  return [...new Set(chunks)];
}

function findPaths(corpus) {
  const paths = [];
  const re = /(\/[a-zA-Z0-9/_-]+)\s*[—\-–:]\s*([^\n]+)/g;
  let m;
  while ((m = re.exec(corpus))) {
    paths.push({ path: m[1], label: m[2].trim().slice(0, 60) });
  }
  return paths;
}

function scoreChunk(chunk, qTerms, q) {
  const l = chunk.toLowerCase();
  let score = qTerms.reduce((s, t) => (l.includes(t) ? s + 1 : s), 0);
  if (score === 0) return 0;

  // Prefer FAQ-style owner knowledge over noisy page listings.
  if (chunk.includes(':/') || chunk.startsWith('- /')) score += 2;
  if (/المؤسسة:|مواد\s|شركة\s|مدرسة\s/i.test(chunk)) score -= 3;
  if (q.includes('معلم') && /teacher|معلم|register/i.test(chunk)) score += 4;
  if (q.includes('تحدي') && /course|challenge|تحدي/i.test(chunk)) score += 4;
  if (q.includes('انضم') && /register|signup|join|انضم/i.test(chunk)) score += 3;

  return score;
}

function truncate(s, max = MAX_SNIPPET) {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim() + '…';
}

function greetingReply(profile) {
  return {
    text:
      `مرحباً! 👋 أنا مساعد ${profile.displayName}.\n\n` +
      'يمكنني مساعدتك في:\n' +
      '• الانضمام كمعلم\n' +
      '• الانضمام للتحديات\n' +
      '• استكشاف المحتوى والدورات\n\n' +
      'ما الذي تبحث عنه؟',
    actions: [],
  };
}

function faqMatch(question, profile) {
  const q = question.toLowerCase();
  for (const line of profile.faqLines) {
    const ll = line.toLowerCase();
    if (q.includes('معلم') && ll.includes('معلم')) return { text: line, actions: [] };
    if (q.includes('تحدي') && ll.includes('تحدي')) return { text: line, actions: [] };
  }
  return null;
}

export function fallbackAnswer(question, { siteKnowledge, pages, livePageContext, siteMap }) {
  const q = question.toLowerCase().trim();
  const profile = parseSiteProfile(siteKnowledge, livePageContext, pages);

  if (isGreeting(question)) {
    return greetingReply(profile);
  }

  if (isIdentityQuestion(question)) {
    return identityReply(profile);
  }

  if (isVague(question)) {
    return greetingReply(profile);
  }

  const faq = faqMatch(question, profile);
  if (faq) return faq;

  const structured = [siteKnowledge, ...(pages || []).map((p) => `${p.path} — ${p.title}\n${p.content}`)]
    .filter(Boolean)
    .join('\n\n');

  const allChunks = structuredChunks(siteKnowledge, pages);

  if (!allChunks.length && !structured.trim()) return null;

  const qTerms = terms(question);
  const extra = [];
  if (q.includes('معلم') || q.includes('teacher')) extra.push('معلم', 'teacher', 'تسجيل', 'register');
  if (q.includes('تحدي') || q.includes('challenge')) extra.push('تحدي', 'challenge', 'courses');
  if (q.includes('انضم') || q.includes('join')) extra.push('انضم', 'join', 'register', 'signup');
  const allTerms = [...new Set([...qTerms, ...extra])];

  const ranked = allChunks
    .map((c) => ({ c, score: scoreChunk(c, allTerms, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const paths = [...profile.paths, ...findPaths(structured)];
  const actions = [];

  for (const p of paths) {
    const pl = p.path.toLowerCase();
    const plabel = p.label.toLowerCase();
    if (
      (q.includes('معلم') && (pl.includes('teacher') || plabel.includes('معلم') || pl.includes('register'))) ||
      (q.includes('تحدي') && (pl.includes('course') || pl.includes('challenge') || plabel.includes('تحدي'))) ||
      (q.includes('انضم') && (pl.includes('register') || pl.includes('signup') || pl.includes('join')))
    ) {
      actions.push({ type: 'navigate', url: p.path, label: p.label || `الذهاب إلى ${p.path}` });
      break;
    }
  }

  if (!actions.length && siteMap?.length && allTerms.length) {
    for (const p of siteMap) {
      const pl = (p.path + ' ' + (p.title || '')).toLowerCase();
      if (allTerms.some((t) => pl.includes(t))) {
        actions.push({ type: 'navigate', url: p.path, label: `الذهاب إلى ${p.title || p.path}` });
        break;
      }
    }
  }

  if (ranked.length === 0) {
    if (actions.length) {
      return { text: 'إليك الصفحة المناسبة لسؤالك:', actions };
    }
    return {
      text:
        'لم أجد إجابة محددة في المحتوى المتاح. جرّب السؤال بطريقة أوضح، مثل:\n' +
        '«كيف أنضم كمعلم؟» أو «أين أجد التحديات؟»',
      actions: [],
    };
  }

  const best = ranked[0];
  if (best.score < 2 && !actions.length) {
    return {
      text:
        'لم أجد إجابة محددة في المحتوى المتاح. جرّب السؤال بطريقة أوضح، مثل:\n' +
        '«كيف أنضم كمعلم؟» أو «أين أجد التحديات؟»',
      actions: [],
    };
  }

  const snippets = ranked.slice(0, MAX_SNIPPETS).map((x) => truncate(x.c));
  let text = snippets.join('\n\n');
  if (text.length > MAX_TOTAL) text = text.slice(0, MAX_TOTAL).trim() + '…';

  return { text, actions };
}

export function userFacingGeminiError(err) {
  const m = err?.message || '';
  if (m.includes('429') || m.includes('quota') || m.includes('Quota exceeded')) {
    return 'تم تجاوز الحد المجاني لـ Gemini (20 طلب/يوم). انتظر حتى الغد، أو أضف مفتاح API جديد مع تفعيل الفوترة في Google AI Studio.';
  }
  if (m.includes('503') || m.includes('high demand')) {
    return 'خدمة Gemini مشغولة حالياً. حاول مرة أخرى بعد دقيقة.';
  }
  if (m.includes('GEMINI_API_KEY')) {
    return 'مفتاح Gemini غير مضبوط على الخادم.';
  }
  return 'عذراً، حدث خطأ أثناء معالجة طلبك.';
}
