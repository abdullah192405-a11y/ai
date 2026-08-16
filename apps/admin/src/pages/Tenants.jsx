import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Building,
  Copy,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { api } from '../api';
import { PLAN_OPTIONS } from '@wba/plans';

const statusLabels = {
  active: { cls: 'badge-green', label: 'نشط' },
  suspended: { cls: 'badge-red', label: 'معلّق' },
  cancelled: { cls: 'badge-red', label: 'مُلغى' },
};

function AddTenantModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState('free');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.createTenant({ name, email, password, plan, notes: notes || undefined });
      setCreated(result);
      onCreated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!created?.credentials) return;
    const text = `البريد: ${created.credentials.email}\nكلمة المرور: ${created.credentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (created) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h2>تم إنشاء الحساب</h2>
            <p>شارك بيانات الدخول مع المستخدم — لن تُعرض مرة أخرى</p>
          </div>
          <div className="modal-body">
            <div
              style={{
                padding: 16,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-0)',
                border: '1px solid var(--border-1)',
                fontFamily: 'var(--mono)',
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <div>
                <span style={{ color: 'var(--text-4)' }}>الشركة: </span>
                {created.tenant.name}
              </div>
              <div style={{ direction: 'ltr', textAlign: 'right' }}>
                <span style={{ color: 'var(--text-4)' }}>Email: </span>
                {created.credentials.email}
              </div>
              <div style={{ direction: 'ltr', textAlign: 'right' }}>
                <span style={{ color: 'var(--text-4)' }}>Password: </span>
                {created.credentials.password}
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 12 }}>
              يمكن للمستخدم تسجيل الدخول في لوحة المستخدم (apps/user) ثم إضافة نطاقه من صفحة المواقع.
            </p>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={copyCredentials}>
              {copied ? <Check size={14} /> : <Copy size={14} />} نسخ البيانات
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              تم
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>إضافة مشترك جديد</h2>
          <p>إنشاء حساب شركة + مستخدم للدخول إلى لوحة المستخدم</p>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">اسم الشركة</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: شركة أكمي"
              required
            />
          </div>
          <div className="field">
            <label className="field-label">البريد الإلكتروني (للدخول)</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>
          <div className="field">
            <label className="field-label">كلمة المرور</label>
            <input
              className="input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 أحرف على الأقل"
              required
              minLength={6}
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
            <div className="field-hint">ستشارك هذه الكلمة مع المستخدم يدوياً</div>
          </div>
          <div className="field">
            <label className="field-label">الباقة</label>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">مجاني</option>
              <option value="starter">مبتدئ</option>
              <option value="pro">احترافي</option>
              <option value="enterprise">مؤسسي</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">ملاحظات (اختياري)</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && (
            <div
              style={{
                fontSize: 12.5,
                color: '#f87171',
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              {error}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <X size={14} /> إلغاء
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTenants();
      setTenants(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const sm =
        t.name.includes(search) ||
        t.email.includes(search) ||
        (t.domain && t.domain.includes(search));
      const pf = planFilter === 'all' || t.plan === planFilter;
      const sf = statusFilter === 'all' || t.status === statusFilter;
      return sm && pf && sf;
    });
  }, [tenants, search, planFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: tenants.length,
      active: tenants.filter((t) => t.status === 'active').length,
      suspended: tenants.filter((t) => t.status === 'suspended').length,
      withWebsites: tenants.filter((t) => t.websites > 0).length,
    }),
    [tenants]
  );

  const toggleTenantStatus = async (tenant) => {
    const next = tenant.status === 'active' ? 'suspended' : 'active';
    setActionLoading(tenant.id);
    try {
      await api.updateTenantStatus(tenant.id, next);
      await load();
      if (selected?.id === tenant.id) {
        setSelected((s) => (s ? { ...s, status: next } : null));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const changePlan = async (tenantId, plan, currentPlan) => {
    if (plan === currentPlan) return;
    setActionLoading(`plan-${tenantId}`);
    try {
      const result = await api.updateTenantPlan(tenantId, plan);
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId ? { ...t, plan: result.plan, planLabel: result.planLabel } : t
        )
      );
      if (selected?.id === tenantId) {
        setSelected((s) =>
          s ? { ...s, plan: result.plan, planLabel: result.planLabel } : s
        );
      }
      if (result.enforcement?.websites?.deactivated?.length || result.enforcement?.apiKeys?.revoked?.length) {
        alert(result.message);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>إدارة المشتركين</h1>
          <p>إنشاء حسابات المستخدمين ومتابعة المشتركين</p>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <UserPlus size={14} /> إضافة مشترك
          </button>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { icon: Users, label: 'إجمالي المشتركين', val: stats.total, color: 'purple' },
          { icon: CheckCircle2, label: 'نشط', val: stats.active, color: 'green' },
          { icon: AlertTriangle, label: 'معلّق', val: stats.suspended, color: 'red' },
          { icon: Building, label: 'لديهم مواقع', val: stats.withWebsites, color: 'blue' },
        ].map((s, i) => (
          <div key={i} className={`stat-card st-${s.color} anim-in`}>
            <div className="stat-top">
              <div className={`stat-icon ${s.color}`}>
                <s.icon size={17} />
              </div>
            </div>
            <div className="stat-val">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card anim-in" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
              <Search
                size={14}
                style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-4)' }}
              />
              <input
                className="input"
                placeholder="بحث بالاسم أو البريد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingRight: 30, fontSize: 12.5 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-4)', fontWeight: 600 }}>الباقة:</span>
              {[
                { v: 'all', l: 'الكل' },
                { v: 'free', l: 'مجاني' },
                { v: 'starter', l: 'مبتدئ' },
                { v: 'pro', l: 'احترافي' },
                { v: 'enterprise', l: 'مؤسسي' },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPlanFilter(p.v)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                    background: planFilter === p.v ? 'var(--accent-muted)' : 'var(--bg-3)',
                    color: planFilter === p.v ? 'var(--accent)' : 'var(--text-3)',
                    border: `1px solid ${planFilter === p.v ? 'var(--accent-border)' : 'var(--border-1)'}`,
                  }}
                >
                  {p.l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-4)', fontWeight: 600 }}>الحالة:</span>
              {['all', 'active', 'suspended', 'cancelled'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                    background: statusFilter === s ? 'var(--accent-muted)' : 'var(--bg-3)',
                    color: statusFilter === s ? 'var(--accent)' : 'var(--text-3)',
                    border: `1px solid ${statusFilter === s ? 'var(--accent-border)' : 'var(--border-1)'}`,
                  }}
                >
                  {s === 'all' ? 'الكل' : statusLabels[s]?.label || s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="card anim-in" style={{ marginBottom: 16, borderColor: 'rgba(248,113,113,0.3)' }}>
          <div className="card-body" style={{ color: '#f87171', fontSize: 13 }}>
            {error}
            <button type="button" className="btn btn-xs btn-secondary" style={{ marginRight: 10 }} onClick={load}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      <div className="card anim-in">
        <div className="card-body">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              جاري التحميل...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>لا يوجد مشتركون بعد</p>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
                <UserPlus size={14} /> إضافة أول مشترك
              </button>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المشترك</th>
                    <th>الباقة</th>
                    <th>الحالة</th>
                    <th>المواقع</th>
                    <th>المستخدمون</th>
                    <th>تاريخ الإنشاء</th>
                    <th>آخر دخول</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(selected?.id === t.id ? null : t)}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', direction: 'ltr', textAlign: 'right' }}>
                          {t.email}
                        </div>
                        {t.domain !== '—' && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>
                            {t.domain}
                          </div>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="input"
                          style={{ width: 'auto', minWidth: 130, fontSize: 12, padding: '4px 8px' }}
                          value={t.plan}
                          disabled={actionLoading === `plan-${t.id}`}
                          onChange={(e) => changePlan(t.id, e.target.value, t.plan)}
                          title="تغيير باقة المشترك"
                        >
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label} ({p.hint})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${statusLabels[t.status]?.cls || 'badge-blue'}`}>
                          <span className="dot" /> {statusLabels[t.status]?.label || t.status}
                        </span>
                      </td>
                      <td>{t.websites}</td>
                      <td>{t.users}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.createdLabel}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border-1)',
              fontSize: 12,
              color: 'var(--text-4)',
              textAlign: 'center',
            }}
          >
            عرض {filtered.length} من {tenants.length} مشترك
          </div>
        )}
      </div>

      {selected && (
        <div className="card anim-in" style={{ marginTop: 16, border: '1px solid var(--accent-border)' }}>
          <div className="card-head">
            <h3>
              <Building size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              {selected.name}
            </h3>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>
              إغلاق
            </button>
          </div>
          <div className="card-body">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 16,
              }}
            >
              {[
                { label: 'البريد', val: selected.email },
                { label: 'الباقة', val: selected.planLabel },
                { label: 'الحالة', val: statusLabels[selected.status]?.label },
                { label: 'المواقع', val: selected.websites },
                { label: 'المستخدمون', val: selected.users },
                { label: 'تاريخ الإنشاء', val: selected.createdLabel },
                { label: 'آخر دخول', val: selected.lastActive },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginBottom: 2 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{item.val}</div>
                </div>
              ))}
            </div>
            {selected.notes && (
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-3)' }}>ملاحظات: {selected.notes}</p>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                تغيير الباقة:
              </label>
              <select
                className="input"
                style={{ width: 'auto', minWidth: 140 }}
                value={selected.plan}
                disabled={actionLoading === `plan-${selected.id}`}
                onChange={(e) => changePlan(selected.id, e.target.value, selected.plan)}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} ({p.hint})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={actionLoading === selected.id}
                onClick={() => toggleTenantStatus(selected)}
              >
                {actionLoading === selected.id ? (
                  <Loader2 size={14} className="spin" />
                ) : selected.status === 'active' ? (
                  <AlertTriangle size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {selected.status === 'active' ? 'تعليق الحساب' : 'إعادة تفعيل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddTenantModal
          onClose={() => setShowAdd(false)}
          onCreated={() => load()}
        />
      )}
    </>
  );
}
