import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Key,
  Lock,
  Unlock,
  Loader2,
  UserPlus,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../api';
import { Link } from 'react-router-dom';
import { PLAN_OPTIONS } from '@wba/plans';

const roleColors = {
  مالك: '#ef4444',
  مدير: '#f97316',
  محرر: '#006c35',
  عارض: '#757ba3',
};

export default function CompaniesUsers() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUsers();
      setAllUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uniqueTenants = [...new Set(allUsers.map((u) => u.tenant))];

  const filtered = allUsers.filter((u) => {
    if (
      search &&
      !u.name.includes(search) &&
      !u.email.includes(search) &&
      !u.tenant.includes(search)
    ) {
      return false;
    }
    if (tenantFilter !== 'all' && u.tenant !== tenantFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  });

  const totalActive = allUsers.filter((u) => u.status === 'active').length;
  const totalSuspended = allUsers.filter((u) => u.status === 'suspended').length;

  const toggleStatus = async (user) => {
    const next = user.status === 'active' ? 'suspended' : 'active';
    setActionLoading(user.id);
    try {
      await api.updateUserStatus(user.id, next);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const resetPassword = async (user) => {
    if (!confirm(`إعادة تعيين كلمة مرور ${user.email}؟`)) return;
    setActionLoading(user.id);
    setResetResult(null);
    try {
      const result = await api.resetUserPassword(user.id);
      setResetResult({ email: result.email, password: result.password });
      setExpanded(user.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const changeTenantPlan = async (tenantId, plan, currentPlan) => {
    if (plan === currentPlan) return;
    setActionLoading(`plan-${tenantId}`);
    try {
      const result = await api.updateTenantPlan(tenantId, plan);
      setAllUsers((prev) =>
        prev.map((u) => (u.tenantId === tenantId ? { ...u, tenantPlan: result.plan } : u))
      );
      if (result.enforcement?.websites?.deactivated?.length || result.enforcement?.apiKeys?.revoked?.length) {
        alert(result.message);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const copyPassword = () => {
    if (!resetResult) return;
    navigator.clipboard.writeText(`Email: ${resetResult.email}\nPassword: ${resetResult.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>المستخدمون</h1>
          <p>
            {loading
              ? 'جاري التحميل...'
              : `${allUsers.length} مستخدم في ${uniqueTenants.length} شركة`}
          </p>
        </div>
        <div className="topbar-right">
          <Link to="/tenants" className="btn btn-primary btn-sm">
            <UserPlus size={14} /> إضافة مشترك
          </Link>
        </div>
      </div>

      <div className="stats-row">
        {[
          { label: 'مستخدمون نشطون', value: totalActive, icon: UserCheck, color: 'green', st: 'st-green' },
          { label: 'إجمالي المستخدمين', value: allUsers.length, icon: Users, color: 'blue', st: 'st-blue' },
          { label: 'الشركات', value: uniqueTenants.length, icon: Users, color: 'purple', st: 'st-purple' },
          { label: 'معلّقون', value: totalSuspended, icon: UserX, color: 'red', st: 'st-red' },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.st}`}>
            <div className="stat-top">
              <div className={`stat-icon ${s.color}`}>
                <s.icon size={18} />
              </div>
            </div>
            <div className="stat-val">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ color: '#f87171', fontSize: 13 }}>
            {error}
            <button type="button" className="btn btn-xs btn-secondary" style={{ marginRight: 10 }} onClick={load}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {uniqueTenants.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <h3>الشركات ({uniqueTenants.length})</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-xs ${tenantFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTenantFilter('all')}
              >
                الكل
              </button>
              {uniqueTenants.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`btn btn-xs ${tenantFilter === name ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTenantFilter(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-4)',
            }}
          />
          <input
            className="input"
            placeholder="بحث بالاسم أو البريد أو الشركة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingRight: 36 }}
          />
        </div>
        <select
          className="input"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="suspended">معلّق</option>
        </select>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              جاري التحميل...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              لا يوجد مستخدمون.{' '}
              <Link to="/tenants" style={{ color: 'var(--accent)' }}>
                أضف مشتركاً
              </Link>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>الشركة</th>
                    <th>الباقة</th>
                    <th>الدور</th>
                    <th>الحالة</th>
                    <th>آخر دخول</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <Fragment key={u.id}>
                      <tr
                        onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'var(--gradient)',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {u.name
                                .split(' ')
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-4)',
                                  direction: 'ltr',
                                  textAlign: 'right',
                                }}
                              >
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{u.tenant}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="input"
                            style={{ width: 'auto', minWidth: 120, fontSize: 12, padding: '4px 8px' }}
                            value={u.tenantPlan || 'free'}
                            disabled={actionLoading === `plan-${u.tenantId}`}
                            onChange={(e) =>
                              changeTenantPlan(u.tenantId, e.target.value, u.tenantPlan)
                            }
                            title="تغيير باقة الشركة"
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: roleColors[u.roleLabel] || 'var(--text-3)',
                            }}
                          >
                            {u.roleLabel}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                            <span className="dot" /> {u.status === 'active' ? 'نشط' : 'معلّق'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.lastLogin}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-xs btn-secondary"
                            disabled={actionLoading === u.id}
                            onClick={() => resetPassword(u)}
                          >
                            {actionLoading === u.id ? (
                              <Loader2 size={11} className="spin" />
                            ) : (
                              <Key size={11} />
                            )}{' '}
                            كلمة مرور
                          </button>
                        </td>
                      </tr>
                      {expanded === u.id && (
                        <tr key={`${u.id}-detail`}>
                          <td colSpan={7} style={{ background: 'var(--bg-3)', padding: 20 }}>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 16,
                                marginBottom: 16,
                              }}
                            >
                              <div>
                                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>تاريخ الإنشاء</span>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.created}</div>
                              </div>
                              <div>
                                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>البريد</span>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    direction: 'ltr',
                                    textAlign: 'right',
                                  }}
                                >
                                  {u.email}
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>الباقة</span>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.tenantPlan}</div>
                              </div>
                            </div>
                            {resetResult?.email === u.email && (
                              <div
                                style={{
                                  padding: 12,
                                  marginBottom: 12,
                                  borderRadius: 8,
                                  background: 'var(--green-muted)',
                                  border: '1px solid rgba(34,197,94,0.2)',
                                  fontSize: 13,
                                }}
                              >
                                كلمة المرور الجديدة:{' '}
                                <code style={{ direction: 'ltr' }}>{resetResult.password}</code>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-secondary"
                                  style={{ marginRight: 8 }}
                                  onClick={copyPassword}
                                >
                                  {copied ? <Check size={11} /> : <Copy size={11} />} نسخ
                                </button>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-xs btn-secondary"
                                disabled={actionLoading === u.id}
                                onClick={() => resetPassword(u)}
                              >
                                <Key size={11} /> إعادة تعيين كلمة المرور
                              </button>
                              {u.status === 'active' ? (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger"
                                  disabled={actionLoading === u.id}
                                  onClick={() => toggleStatus(u)}
                                >
                                  <Lock size={11} /> تعليق
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-secondary"
                                  style={{ color: 'var(--green)' }}
                                  disabled={actionLoading === u.id}
                                  onClick={() => toggleStatus(u)}
                                >
                                  <Unlock size={11} /> إعادة تفعيل
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
