import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Plus, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { api, auth } from '../api';
import DomainVerifyCard from '../components/DomainVerifyCard';
import LoadingState from '../components/LoadingState';
import { isWebsiteOwned } from '../lib/websiteOwnership';
import { rememberEmbedKey } from '../lib/setupSteps';

export default function Websites({ user }) {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [changing, setChanging] = useState(false);
  const [togglingWidget, setTogglingWidget] = useState(false);
  const [widgetError, setWidgetError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.getWebsites();
      const selected =
        list.find((w) => w.id === user?.websiteId) || list[0] || null;
      setSite(selected);
      if (selected && !changing) setDomain(selected.domain);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.websiteId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const value = domain.trim();
      if (site?.id) {
        const result = await api.updateWebsite(site.id, { domain: value });
        setSite(result.website);
        if (result.key) rememberEmbedKey(result.key, result.website?.id || site.id);
      } else {
        const result = await api.createWebsite({ domain: value });
        auth.updateSession({ token: result.token, user: result.user });
        setSite(result.website);
        if (result.key) rememberEmbedKey(result.key, result.website?.id || result.user?.websiteId);
      }
      setChanging(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleWidget = async () => {
    if (!site?.id) return;
    setWidgetError('');
    setTogglingWidget(true);
    try {
      const result = await api.setWebsiteWidget(site.id, !site.widgetEnabled);
      setSite(result.website);
    } catch (err) {
      setWidgetError(err.message);
    } finally {
      setTogglingWidget(false);
    }
  };

  const owned = isWebsiteOwned(site);
  const showForm = !site || changing;

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>المواقع</h1>
          <p>أضف موقعك، أثبِت ملكيته، ثم زُف محتوى المتجر</p>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {site && !changing && (
            <div className="card anim-in" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div className="stat-icon purple" style={{ width: 48, height: 48 }}>
                    <Globe size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 2 }}>
                      الموقع المحدد
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, direction: 'ltr', textAlign: 'left' }}>
                      {site.domain}
                    </div>
                  </div>
                  {owned && (
                    <span className="badge badge-green">
                      <CheckCircle2 size={11} /> موثّق
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setChanging(true);
                      setDomain(site.domain);
                      setError('');
                    }}
                  >
                    تغيير الموقع
                  </button>
                </div>

                <DomainVerifyCard site={site} onUpdated={load} />

                {owned && (
                  <div className="widget-toggle-row" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-1)' }}>
                    <button
                      type="button"
                      className={`toggle-switch${site.widgetEnabled ? ' is-on' : ''}`}
                      onClick={toggleWidget}
                      disabled={togglingWidget}
                      role="switch"
                      aria-checked={site.widgetEnabled}
                      aria-label="إظهار أو إخفاء المساعد على الموقع"
                    >
                      <span className="toggle-switch-knob" />
                    </button>
                    <div style={{ flex: 1 }}>
                      <div className="widget-toggle-label">
                        {site.widgetEnabled ? (
                          <>
                            <Eye size={14} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                            المساعد ظاهر على الموقع
                          </>
                        ) : (
                          <>
                            <EyeOff size={14} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                            المساعد مخفي عن الموقع
                          </>
                        )}
                      </div>
                      <div className="widget-toggle-hint">
                        {site.widgetEnabled
                          ? 'الزوار يرون أيقونة المحادثة الآن. أطفئه لإخفائه فوراً دون حذف كود التضمين.'
                          : 'كود التضمين موجود لكن الويدجت متوقف — لن يظهر للزوار حتى تفعّله من هنا.'}
                      </div>
                      {togglingWidget && (
                        <div className="widget-toggle-hint">
                          <Loader2 size={12} className="spin" style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                          جاري الحفظ...
                        </div>
                      )}
                      {widgetError && (
                        <div style={{ fontSize: 12.5, color: '#f87171', marginTop: 4 }}>{widgetError}</div>
                      )}
                    </div>
                  </div>
                )}

                {owned && (
                  <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link to="/knowledge-base" className="btn btn-primary">
                      <Globe size={14} /> زحف الموقع
                    </Link>
                    <Link to="/install" className="btn btn-secondary">
                      مفتاح الربط والتثبيت
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {showForm && (
            <form className="card anim-in" onSubmit={submit}>
              <div className="card-head">
                <h3>
                  <Globe size={14} /> {site ? 'تغيير الموقع المحدد' : 'أضف موقعك'}
                </h3>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 16 }}>
                  اكتب النطاق الذي تملكه. يُحدَّد تلقائياً بعد الإضافة، ثم يظهر رمز التحقق.
                </p>
                <div className="field">
                  <label className="field-label">النطاق</label>
                  <input
                    className="input"
                    placeholder="mystore.sa أو example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
                {error && (
                  <div style={{ fontSize: 12.5, color: '#f87171', marginBottom: 8 }}>{error}</div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving || !domain.trim()}>
                    {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                    {saving ? 'جاري الإضافة...' : site ? 'تحديث الموقع' : 'إضافة الموقع'}
                  </button>
                  {changing && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setChanging(false);
                        setError('');
                      }}
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}
