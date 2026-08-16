import { useMemo, useState, useEffect } from 'react';
import {
  Check, Copy, Search, ExternalLink, ChevronDown, ChevronUp,
  Clock, AlertTriangle, CircleHelp, KeyRound, Key, Loader2,
} from 'lucide-react';
import {
  EMBED_PLATFORMS,
  EMBED_GROUPS,
  getEmbedSnippet,
  getEmbedPlatform,
} from '@wba/dashboard-ui/embedIntegrations';
import { PLATFORM_STORAGE_KEY } from '../lib/setupSteps';

export default function EmbedCodePanel({
  baseUrl,
  apiKey = 'YOUR_API_KEY',
  defaultPlatform = 'custom-html',
  platform: controlledPlatform,
  onPlatformChange,
  persistPlatform = false,
  mode = 'full',
  compact = false,
  showKeyField = true,
  onCreateKey,
  creatingKey = false,
  createKeyError = '',
  websiteDomain = '',
  keyPrefix = '',
}) {
  const [internalPlatform, setInternalPlatform] = useState(
    () => controlledPlatform || localStorage.getItem(PLATFORM_STORAGE_KEY) || defaultPlatform
  );
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [keyInput, setKeyInput] = useState(
    apiKey && apiKey !== 'YOUR_API_KEY' ? apiKey : ''
  );
  const [tipsOpen, setTipsOpen] = useState(false);

  const activePlatform = controlledPlatform ?? internalPlatform;

  useEffect(() => {
    if (controlledPlatform != null) setInternalPlatform(controlledPlatform);
  }, [controlledPlatform]);

  useEffect(() => {
    if (apiKey && apiKey !== 'YOUR_API_KEY') setKeyInput(apiKey);
  }, [apiKey]);

  const selectPlatform = (id) => {
    setInternalPlatform(id);
    if (persistPlatform) localStorage.setItem(PLATFORM_STORAGE_KEY, id);
    onPlatformChange?.(id);
    setTipsOpen(false);
  };

  const showPicker = mode === 'full' || mode === 'platform';
  const showGuide = mode === 'full' || mode === 'code' || mode === 'platform';

  const resolvedKey = keyInput.trim() || apiKey || 'YOUR_API_KEY';
  const snippet = getEmbedSnippet({
    platformId: activePlatform,
    baseUrl,
    apiKey: resolvedKey,
  });
  const selected = getEmbedPlatform(activePlatform);

  const copy = () => {
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const match = (p) => {
      if (!q) return true;
      const hay = [p.id, p.label, p.blurb, ...(p.aliases || [])].join(' ').toLowerCase();
      return hay.includes(q);
    };
    return EMBED_GROUPS
      .map((g) => ({ ...g, items: EMBED_PLATFORMS.filter((p) => p.group === g.id && match(p)) }))
      .filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <div className={`embed-guide${compact ? ' is-compact' : ''}`}>
      {showPicker && (
        <div className="embed-picker">
          {!compact && (
            <div className="embed-search">
              <Search size={15} />
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن منصتك… مثال: سلة"
                aria-label="بحث عن المنصة"
              />
            </div>
          )}
          {groups.map((g) => (
            <div key={g.id} className="embed-group">
              <div className="embed-group-label">{g.label}</div>
              <div className="embed-platform-grid">
                {g.items.map((p) => {
                  const active = activePlatform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPlatform(p.id)}
                      className={`embed-platform-btn${active ? ' is-active' : ''}`}
                    >
                      <span className="embed-platform-emoji">{p.emoji}</span>
                      <span className="embed-platform-name">{p.label}</span>
                      {p.blurb && <span className="embed-platform-blurb">{p.blurb}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="embed-empty">لا توجد منصة بهذا الاسم — جرّب «سلة» أو «HTML».</p>
          )}
        </div>
      )}

      {showGuide && (
        <div className="embed-detail">
          <div className="embed-hero">
            <div className="embed-hero-emoji">{selected.emoji}</div>
            <div className="embed-hero-body">
              <h3>كيف تثبّت المساعد على {selected.label}</h3>
              <p>{snippet.summary}</p>
              <div className="embed-hero-meta">
                <span className={`embed-diff embed-diff-${snippet.difficulty}`}>
                  {snippet.difficultyLabel}
                </span>
                {snippet.time && (
                  <span className="embed-time">
                    <Clock size={12} /> {snippet.time}
                  </span>
                )}
                {snippet.audience && <span className="embed-audience">{snippet.audience}</span>}
              </div>
              {snippet.loginUrl && (
                <a
                  className="btn btn-secondary btn-sm"
                  href={snippet.loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 10 }}
                >
                  <ExternalLink size={13} /> {snippet.loginLabel || 'فتح المنصة'}
                </a>
              )}
            </div>
          </div>

          {showKeyField && (
            <div className="embed-key-field">
              <label className="field-label">
                <KeyRound size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                مفتاح الربط (يُوضع داخل الكود تلقائياً)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <input
                  className="input"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="الصق المفتاح هنا — يبدأ عادة بـ pk_"
                  style={{ direction: 'ltr', textAlign: 'left', fontFamily: 'var(--mono)', flex: 1 }}
                  autoComplete="off"
                  spellCheck={false}
                />
                {onCreateKey && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onCreateKey}
                    disabled={creatingKey}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {creatingKey ? <Loader2 size={14} className="spin" /> : <Key size={14} />}
                    {creatingKey ? 'جاري الإنشاء...' : 'إنشاء المفتاح'}
                  </button>
                )}
              </div>
              {createKeyError && (
                <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 6 }}>{createKeyError}</div>
              )}
              <div className="field-hint">
                {websiteDomain && (
                  <>
                    مربوط بالموقع المحدد: <code style={{ direction: 'ltr' }}>{websiteDomain}</code>
                    {keyPrefix && resolvedKey === 'YOUR_API_KEY' ? (
                      <> — المفتاح الحالي يبدأ بـ <code style={{ direction: 'ltr' }}>{keyPrefix}…</code></>
                    ) : null}
                    <br />
                  </>
                )}
                {resolvedKey === 'YOUR_API_KEY'
                  ? 'اضغط «إنشاء المفتاح» ليُدرج داخل الكود تلقائياً لهذا الموقع.'
                  : 'الكود أدناه يستخدم مفتاح هذا الموقع. لا تشارك المفتاح الكامل مع أحد.'}
              </div>
            </div>
          )}

          <ol className="embed-steps">
            {(snippet.steps || []).map((step, i) => (
              <li key={i} className="embed-step">
                <span className="embed-step-num">{i + 1}</span>
                <div>
                  <div className="embed-step-title">{step.title}</div>
                  {step.detail && <p className="embed-step-detail">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>

          {snippet.warning && (
            <div className="embed-warning">
              <AlertTriangle size={15} />
              <span>{snippet.warning}</span>
            </div>
          )}

          <div className="embed-code-wrap">
            <div className="embed-code-head">
              <span>{snippet.codeLabel || 'الكود'}</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'تم النسخ' : 'نسخ الكود'}
              </button>
            </div>
            {snippet.codeNote && <p className="embed-code-note">{snippet.codeNote}</p>}
            <div className="code embed-code-block">
              <code>{snippet.code}</code>
            </div>
          </div>

          {snippet.after?.length > 0 && (
            <div className="embed-after">
              <div className="embed-after-title">بعد الحفظ — تأكد أن كل شيء يعمل</div>
              <ol>
                {snippet.after.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          )}

          {snippet.troubleshooting?.length > 0 && (
            <div className="embed-tips">
              <button
                type="button"
                className="embed-tips-toggle"
                onClick={() => setTipsOpen((v) => !v)}
              >
                <CircleHelp size={15} />
                لم يظهر المساعد؟ حلول سريعة
                {tipsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {tipsOpen && (
                <div className="embed-tips-body">
                  {snippet.troubleshooting.map((t, i) => (
                    <div key={i} className="embed-tip">
                      <strong>{t.q}</strong>
                      <p>{t.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
