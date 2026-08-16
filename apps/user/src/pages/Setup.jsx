import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  Globe, Plus, Loader2, Key, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { api, auth } from '../api';
import { useSetupProgress } from '../hooks/useSetupProgress';
import {
  SETUP_STEPS,
  getFirstIncompleteStep,
  PLATFORM_STORAGE_KEY,
  rememberEmbedKey,
  getRememberedEmbedKey,
} from '../lib/setupSteps';
import { isWebsiteOwned, needsOwnershipVerify } from '../lib/websiteOwnership';
import SetupStepper from '../components/SetupStepper';
import SetupStepNav, { SetupStepHeader } from '../components/SetupStepNav';
import EmbedCodePanel from '../components/EmbedCodePanel';
import DomainVerifyCard from '../components/DomainVerifyCard';
import KnowledgeBase from './KnowledgeBase';
import Customize from './Customize';
import PlanLimitBanner from '../components/PlanLimitBanner';

function DomainStep({ user, progress }) {
  const step = SETUP_STEPS[0];
  const [domain, setDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [crawlFrequency, setCrawlFrequency] = useState('daily');
  const [autoCrawl, setAutoCrawl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {});
  }, []);

  const atLimit = usage?.limits?.websites != null && usage.used.websites >= usage.limits.websites;
  const site = progress.activeWebsite;
  const owned = isWebsiteOwned(site);
  const awaitingVerify = needsOwnershipVerify(site);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (site?.id) {
        await api.updateWebsite(site.id, {
          domain: domain.trim(),
          displayName: displayName.trim() || undefined,
        });
      } else {
        const result = await api.createWebsite({
          domain: domain.trim(),
          displayName: displayName.trim() || undefined,
          autoCrawl,
          crawlFrequency: autoCrawl ? crawlFrequency : 'manual',
        });
        auth.updateSession({ token: result.token, user: result.user });
      }
      setDomain('');
      setDisplayName('');
      setChanging(false);
      await progress.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showForm = !site || changing;

  return (
    <>
      <SetupStepHeader step={step} progress={progress} />

      {site && !changing && (
        <div className="card anim-in">
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div className="stat-icon purple" style={{ width: 48, height: 48 }}>
                <Globe size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, direction: 'ltr', textAlign: 'left' }}>
                  {site.domain}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                  {owned
                    ? 'تم تسجيل موقعك وإثبات ملكيته — أكمل الخطوات التالية أو غيّر النطاق إن لم يكن هذا موقعك'
                    : 'تم حفظ الموقع. أثبت الملكية أدناه قبل المتابعة'}
                </div>
              </div>
              {owned && (
                <span className="badge badge-green">
                  <CheckCircle2 size={11} /> موثّق
                </span>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                setChanging(true);
                setDomain(site.domain);
                setDisplayName(site.displayName || site.name || '');
                setError('');
              }}>
                تغيير النطاق
              </button>
            </div>
            <DomainVerifyCard site={site} onUpdated={() => progress.refresh()} />
          </div>
        </div>
      )}

      {showForm && (
        <form className="card anim-in" onSubmit={submit} style={site && changing ? { marginTop: 16 } : undefined}>
          <div className="card-head">
            <h3><Globe size={14} /> {site ? 'أدخل الموقع الذي تملكه' : 'أضف الموقع الذي تملكه'}</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 16 }}>
              سجّل نطاقك أولاً. بعد الحفظ يظهر رمز التحقق لتثبيته في DNS — لا يُعرض الرمز قبل إضافة الموقع.
            </p>
            <div className="field">
              <label className="field-label">رابط الموقع أو النطاق</label>
              <input
                className="input"
                placeholder="mystore.sa أو example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              <div className="field-hint">
                اكتب عنوان متجرك بدون https — مثال: <code style={{ direction: 'ltr' }}>store.salla.sa</code>
              </div>
            </div>
            <div className="field">
              <label className="field-label">اسم يظهر لك في اللوحة (اختياري)</label>
              <input
                className="input"
                placeholder="متجري"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {!site && (
              <div className="field">
                <label className="field-label">تحديث محتوى المساعد تلقائياً (اختياري)</label>
                <select
                  className="input"
                  value={autoCrawl ? crawlFrequency : 'manual'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'manual') setAutoCrawl(false);
                    else {
                      setAutoCrawl(true);
                      setCrawlFrequency(v);
                    }
                  }}
                >
                  <option value="hourly">كل ساعة</option>
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="manual">يدوي فقط</option>
                </select>
              </div>
            )}
            {error && (
              <div style={{ fontSize: 12.5, color: '#f87171', marginTop: 8 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || (!site && atLimit)}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                {loading ? 'جاري الحفظ...' : site ? 'حفظ النطاق' : 'حفظ الموقع'}
              </button>
              {changing && (
                <button type="button" className="btn btn-ghost" onClick={() => { setChanging(false); setError(''); }}>
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      <SetupStepNav
        stepId={step.id}
        progress={progress}
        continueDisabled={!progress.hasVerifiedDomain}
        continueLabel={
          awaitingVerify ? 'أثبت الملكية أولاً' : progress.hasVerifiedDomain ? 'التالي' : 'أضف الموقع أولاً'
        }
      />
    </>
  );
}

function requireOwnedSite(user, progress) {
  if (progress.loading) return null;
  if (!user?.websiteId || !progress.hasVerifiedDomain) {
    return <Navigate to="/setup/domain" replace />;
  }
  return null;
}

function KnowledgeStep({ user, progress }) {
  const step = SETUP_STEPS[1];
  const gate = requireOwnedSite(user, progress);
  if (gate) return gate;

  return (
    <>
      <SetupStepHeader step={step} progress={progress} />
      <KnowledgeBase user={user} setupMode />
      <SetupStepNav
        stepId={step.id}
        progress={progress}
        continueDisabled={!progress.hasKnowledge}
        continueLabel={progress.hasKnowledge ? 'التالي' : 'أكمل الزحف أو ارفع مصدراً أولاً'}
      />
    </>
  );
}

function ApiKeyStep({ user, progress }) {
  const navigate = useNavigate();
  const step = SETUP_STEPS[2];
  const [name, setName] = useState('ويدجت الموقع');
  const [generated, setGenerated] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {});
  }, []);

  const gate = requireOwnedSite(user, progress);
  if (gate) return gate;

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const existing = await api.getKeys().catch(() => []);
      for (const k of existing.filter((x) => !x.revoked)) {
        await api.revokeKey(k.id).catch(() => {});
      }
      const res = await api.createKey(name.trim() || 'ويدجت الموقع', ['read:assistant']);
      setGenerated(res.key);
      rememberEmbedKey(res.key, user?.websiteId);
      await progress.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyKey = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <SetupStepHeader step={step} progress={progress} />

      {progress.hasApiKey && !generated ? (
        <div className="card anim-in">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="stat-icon green" style={{ width: 48, height: 48 }}>
              <Key size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>يوجد مفتاح سابق</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                {progress.activeKey?.name} — <code style={{ direction: 'ltr' }}>{progress.activeKey?.key_prefix}…</code>
                <br />
                السر الكامل لا يُعرض مرة أخرى. أنشئ مفتاحاً جديداً إن لم تحفظه.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={create}
              disabled={creating}
            >
              {creating ? <Loader2 size={14} className="spin" /> : <Key size={14} />}
              {creating ? 'جاري الإنشاء...' : 'إنشاء المفتاح'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card anim-in">
          <div className="card-head">
            <h3><Key size={14} /> إنشاء مفتاح الربط</h3>
          </div>
          <div className="card-body">
            <PlanLimitBanner usage={usage} kind="apiKeys" />
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.65 }}>
              هذا المفتاح يربط المساعد بمتجرك. سيُدرج داخل كود التثبيت في الخطوة التالية. يُعرض مرة واحدة فقط — انسخه الآن.
            </p>
            {!generated ? (
              <>
                <div className="field">
                  <label className="field-label">اسم المفتاح</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                {error && <div style={{ color: '#f87171', fontSize: 12.5, marginTop: 8 }}>{error}</div>}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={create}
                  disabled={!name.trim() || creating}
                  style={{ marginTop: 12 }}
                >
                  {creating ? <Loader2 size={14} className="spin" /> : <Key size={14} />}
                  {creating ? 'جاري الإنشاء...' : 'إنشاء المفتاح'}
                </button>
              </>
            ) : (
              <>
                <div style={{
                  padding: '14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--green-muted)', border: '1px solid rgba(52,211,153,0.15)',
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                  <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>تم إنشاء المفتاح</span>
                </div>
                <div className="code" style={{ wordBreak: 'break-all' }}>
                  <code style={{ fontSize: 11.5, direction: 'ltr' }}>{generated}</code>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={copyKey}>
                    {copied ? <CheckCircle2 size={13} /> : <Key size={13} />}
                  </button>
                </div>
                <div style={{
                  marginTop: 12, padding: '12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--amber-muted)', border: '1px solid rgba(251,191,36,0.15)',
                  fontSize: 12.5, color: 'var(--amber)', lineHeight: 1.6,
                }}>
                  <AlertTriangle size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                  احفظ المفتاح الآن — لن يُعرض مرة أخرى. في الخطوة التالية سيظهر داخل كود التثبيت تلقائياً.
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate('/setup/platform')}
                >
                  متابعة لتثبيت المساعد
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <SetupStepNav
        stepId={step.id}
        progress={progress}
        continueDisabled={!progress.hasApiKey}
      />
    </>
  );
}

function PlatformStep({ user, progress }) {
  const step = SETUP_STEPS[3];
  const [platform, setPlatform] = useState(
    () => localStorage.getItem(PLATFORM_STORAGE_KEY) || 'custom-html'
  );

  const gate = requireOwnedSite(user, progress);
  if (gate) return gate;

  const select = (id) => {
    setPlatform(id);
    localStorage.setItem(PLATFORM_STORAGE_KEY, id);
    progress.refresh();
  };

  const rememberedKey = getRememberedEmbedKey(user?.websiteId);

  return (
    <>
      <SetupStepHeader step={step} progress={progress} />
      <div className="card anim-in">
        <div className="card-head">
          <h3>اختر منصة متجرك واتبع الخطوات</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
            اضغط على منصتك — مثلاً <strong>سلة</strong> — وستظهر لك التعليمات كاملة: أين تدخل، أين تلصق الكود، وكيف تتأكد أنه يعمل.
          </p>
          <EmbedCodePanel
            baseUrl={api.baseUrl}
            apiKey={rememberedKey || 'YOUR_API_KEY'}
            platform={platform}
            onPlatformChange={select}
            persistPlatform
          />
        </div>
      </div>
      <SetupStepNav
        stepId={step.id}
        progress={progress}
        continueDisabled={!platform}
        continueLabel="تم التثبيت — تخصيص الشكل"
      />
    </>
  );
}

function CustomizeStep({ user, progress }) {
  const step = SETUP_STEPS[4];
  const gate = requireOwnedSite(user, progress);
  if (gate) return gate;

  return (
    <>
      <SetupStepHeader step={step} progress={progress} />
      <Customize user={user} setupMode />
      <SetupStepNav stepId={step.id} progress={progress} continueLabel="إنهاء الإعداد" />
    </>
  );
}

function SetupIndex({ progress }) {
  if (progress.loading) return null;
  const first = getFirstIncompleteStep(progress);
  return <Navigate to={first.path} replace />;
}

export default function Setup({ user }) {
  const progress = useSetupProgress(user);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>ابدأ من هنا</h1>
          <p>خمس خطوات: موقعك وملكيته → تعليم المساعد → مفتاح الربط → التثبيت → الشكل</p>
        </div>
      </div>
      <SetupStepper progress={progress} />
      <Routes>
        <Route index element={<SetupIndex progress={progress} />} />
        <Route path="domain" element={<DomainStep user={user} progress={progress} />} />
        <Route path="knowledge" element={<KnowledgeStep user={user} progress={progress} />} />
        <Route path="api-key" element={<ApiKeyStep user={user} progress={progress} />} />
        <Route path="platform" element={<PlatformStep user={user} progress={progress} />} />
        <Route path="customize" element={<CustomizeStep user={user} progress={progress} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    </>
  );
}
