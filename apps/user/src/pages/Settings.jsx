import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, Lock, Palette, Globe } from 'lucide-react';
import { api, auth } from '../api';
import { initials } from '../lib/format';
import LoadingState from '../components/LoadingState';
import ThemeToggle from '../components/ThemeToggle';
import { useTenantWebsites } from '../hooks/useTenantWebsites';

export default function Settings() {
  const user = auth.user;
  const { active: website } = useTenantWebsites(user);
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    api
      .getSettings()
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName || '');
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSaveMsg('');
    api
      .updateSettings({ fullName })
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName || '');
        setSaveMsg('تم حفظ التغييرات');
        if (auth.user) {
          auth.updateSession({ token: auth.token, user: { ...auth.user, fullName: p.fullName } });
        }
      })
      .catch((err) => setSaveMsg(err.message || 'فشل الحفظ'))
      .finally(() => setSaving(false));
  };

  const handlePasswordChange = () => {
    setPwdMsg('');
    setPwdError('');
    if (newPassword !== confirmPassword) {
      setPwdError('كلمات المرور الجديدة غير متطابقة');
      return;
    }
    setPwdSaving(true);
    api
      .changePassword(currentPassword, newPassword)
      .then((res) => {
        setPwdMsg(res.message || 'تم تحديث كلمة المرور');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      })
      .catch((err) => setPwdError(err.message || 'فشل تحديث كلمة المرور'))
      .finally(() => setPwdSaving(false));
  };

  const displayName = profile?.fullName || '—';
  const displayEmail = profile?.email || '—';
  const avatarInitials = initials(profile?.fullName, profile?.email);

  if (loading) return <LoadingState />;

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>الإعدادات</h1>
          <p>حسابك، موقعك، ومظهر اللوحة</p>
        </div>
        <div className="topbar-right">
          {saveMsg && (
            <span
              style={{
                fontSize: 12.5,
                color: saveMsg.includes('فشل') ? 'var(--red)' : 'var(--green)',
                marginInlineEnd: 10,
              }}
            >
              {saveMsg}
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ الاسم'}
          </button>
        </div>
      </div>

      <div className="card anim-in" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>حسابك</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--gradient)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {avatarInitials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{displayEmail}</div>
            </div>
          </div>
          <div className="field">
            <label className="field-label">الاسم المعروض</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">البريد الإلكتروني</label>
            <input
              className="input"
              value={displayEmail}
              readOnly
              type="email"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>
        </div>
      </div>

      <div className="card anim-in" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>
            <Globe size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
            موقعك
          </h3>
        </div>
        <div className="card-body">
          {website ? (
            <>
              <div className="field">
                <label className="field-label">الموقع المحدد</label>
                <input
                  className="input"
                  value={website.domain}
                  readOnly
                  style={{ direction: 'ltr', textAlign: 'left' }}
                />
              </div>
              <Link to="/websites" className="btn btn-secondary btn-sm">
                <Globe size={14} /> إدارة الموقع والتحقق
              </Link>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 12 }}>لم يُضف موقع بعد.</p>
              <Link to="/websites" className="btn btn-primary btn-sm">
                <Globe size={14} /> إضافة موقع
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card anim-in" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>
            <Palette size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
            مظهر اللوحة
          </h3>
        </div>
        <div className="card-body">
          <ThemeToggle embedded />
        </div>
      </div>

      <div className="card anim-in">
        <div className="card-head">
          <h3>
            <Lock size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
            كلمة المرور
          </h3>
        </div>
        <div className="card-body">
          {pwdError && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{pwdError}</div>
          )}
          {pwdMsg && (
            <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12 }}>{pwdMsg}</div>
          )}
          <div className="field">
            <label className="field-label">كلمة المرور الحالية</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">كلمة المرور الجديدة</label>
            <input
              className="input"
              type="password"
              placeholder="٨ أحرف على الأقل"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">تأكيد كلمة المرور الجديدة</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handlePasswordChange}
            disabled={pwdSaving}
          >
            {pwdSaving ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </div>
      </div>
    </>
  );
}
