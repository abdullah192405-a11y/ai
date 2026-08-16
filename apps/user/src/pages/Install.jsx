import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plug, Palette } from 'lucide-react';
import { api } from '../api';
import EmbedCodePanel from '../components/EmbedCodePanel';
import { PLATFORM_STORAGE_KEY, getRememberedEmbedKey, rememberEmbedKey } from '../lib/setupSteps';
import { useTenantWebsites } from '../hooks/useTenantWebsites';

export default function Install({ user }) {
  const { active: website } = useTenantWebsites(user);
  const [platform, setPlatform] = useState(
    () => localStorage.getItem(PLATFORM_STORAGE_KEY) || 'custom-html'
  );
  const [keys, setKeys] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [fullKey, setFullKey] = useState(() => getRememberedEmbedKey(user?.websiteId));

  useEffect(() => {
    setFullKey(getRememberedEmbedKey(user?.websiteId));
    api.getKeys().then(setKeys).catch(() => setKeys([]));
  }, [user?.websiteId]);

  const activeKeys = keys.filter(
    (k) => !k.revoked && (!user?.websiteId || k.website_id === user.websiteId)
  );
  const embedKey = fullKey || 'YOUR_API_KEY';
  const siteKey = activeKeys[0];

  const createKey = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const all = keys.filter((k) => !k.revoked);
      for (const k of all) {
        await api.revokeKey(k.id).catch(() => {});
      }
      const res = await api.createKey('مفتاح الربط', ['read:assistant']);
      if (!res?.key) throw new Error('لم يُرجع الخادم المفتاح');
      rememberEmbedKey(res.key, user?.websiteId);
      setFullKey(res.key);
      const next = await api.getKeys().catch(() => []);
      setKeys(next);
    } catch (err) {
      setCreateError(err.message || 'تعذر إنشاء المفتاح');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>ثبّت المساعد على موقعك</h1>
          <p>
            كود التثبيت لموقعك المحدد
            {website?.domain ? (
              <>: <code style={{ direction: 'ltr' }}>{website.domain}</code></>
            ) : null}
          </p>
        </div>
      </div>

      <div className="install-intro card anim-in" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="install-intro-grid">
            <div className="install-intro-item">
              <span className="install-intro-num">١</span>
              <div>
                <strong>اختر منصتك</strong>
                <p>سلة أو زد أو أي موقع. التعليمات تتغيّر حسب اختيارك.</p>
              </div>
            </div>
            <div className="install-intro-item">
              <span className="install-intro-num">٢</span>
              <div>
                <strong>أنشئ مفتاح الربط</strong>
                <p>من خانة «مفتاح الربط» داخل الدليل أدناه.</p>
              </div>
            </div>
            <div className="install-intro-item">
              <span className="install-intro-num">٣</span>
              <div>
                <strong>انسخ الكود والصقه</strong>
                <p>افتح موقعك كزائر لترى أيقونة المحادثة.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card anim-in">
        <div className="card-head">
          <h3><Plug size={15} /> دليل التثبيت حسب منصتك</h3>
        </div>
        <div className="card-body">
          <EmbedCodePanel
            baseUrl={api.baseUrl}
            apiKey={embedKey}
            platform={platform}
            onPlatformChange={setPlatform}
            persistPlatform
            onCreateKey={createKey}
            creatingKey={creating}
            createKeyError={createError}
            websiteDomain={website?.domain}
            keyPrefix={siteKey?.key_prefix}
          />
        </div>
      </div>

      <div className="card anim-in" style={{ marginTop: 16 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>تريد تغيير اللون أو رسالة الترحيب؟</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              من صفحة شكل المساعد — لا تحتاج إعادة لصق الكود بعد الحفظ.
            </div>
          </div>
          <Link to="/customize" className="btn btn-secondary">
            <Palette size={14} /> شكل المساعد
          </Link>
        </div>
      </div>
    </>
  );
}
