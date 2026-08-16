// Keep assistant replies user-friendly — strip leaked internal prompts if the model echoes them.

const INTERNAL_STEP_RE =
  /^\s*\d+\.\s*(?:راجع|حدّ?د|اذكر|إن لم|لا تعرض|استخدم)/gmu;

const INTERNAL_HEADER_RE =
  /\[تحليل\s+(?:بحث|داخلي)[^\]]*\]/gi;

export const RESPONSE_STYLE_RULES = `
=== شكل الرد للمستخدم (إلزامي) ===
- اكتب 2–4 جمل طبيعية كمساعد مبيعات ودود — بدون تقارير أو قوائم طويلة.
- لا تذكر خطوات تحليل داخلية ولا ترقيم "1." "2." ولا عبارات مثل "راجع بيانات قاعدة البيانات" أو "الصفحات المفهرسة".
- لا تدرج مسارات خام (/cars/uuid أو /cars?make=...) في النص — اذكر أسماء السيارات أو الأقسام بالعربية فقط.
- عند وجود عدة سيارات: اذكر العدد التقريبي و3–5 أمثلة بالاسم، ثم اقترح زر تنقل واحد للقسم المناسب.
- ACTIONS_JSON للأزرار فقط — لا تظهر للمستخدم.
`.trim();

export function sanitizeAssistantResponse(text) {
  let out = String(text || '').trim();
  if (!out) return out;

  // Drop leading internal-analysis block (often copied from old user-message prefix).
  if (/^(?:\d+\.\s*راجع|\[تحليل)/u.test(out)) {
    const parts = out.split(/\n(?=\S)/);
    const kept = parts.filter(
      (line) =>
        !/^\d+\.\s*(?:راجع|حدّ?د|اذكر|إن لم|لا تعرض|استخدم)/u.test(line.trim()) &&
        !/^\[تحليل/u.test(line.trim())
    );
    if (kept.length && kept.join('\n').trim().length > 20) {
      out = kept.join('\n').trim();
    }
  }

  out = out.replace(INTERNAL_HEADER_RE, '').replace(INTERNAL_STEP_RE, '').trim();

  // Drop dangling "see paths below" lines when no paths follow.
  out = out.replace(
    /\n(?:[-—]\s*)?(?:يمكنك[^\n]*(?:المسارات|الروابط)\s*(?:التالية|:)?|من خلال(?: المسارات)?)\s*:?\s*$/u,
    ''
  );

  // Collapse excessive blank lines after cleanup.
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out || String(text || '').trim();
}
