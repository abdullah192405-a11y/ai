import { NavLink } from 'react-router-dom';
import { LogOut, Sparkles } from 'lucide-react';
import { auth } from '../api';
import { buildNav } from '../lib/constants';
import { initials } from '../lib/format';

export default function Sidebar({ user }) {
  const account = user || auth.user;

  const logout = () => {
    auth.clear();
    window.location.reload();
  };

  const nav = buildNav(Boolean(account?.websiteId));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Sparkles size={18} />
        </div>
        <h1>
          WBA<small>مساعد الموقع الذكي</small>
        </h1>
      </div>

      <nav className="sidebar-nav">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <item.icon size={17} />
            <span style={{ flex: 1 }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {initials(account?.fullName, account?.email)}
          </div>
          <div className="sidebar-user-meta">
            <strong>{account?.fullName || account?.tenantName || 'مستخدم'}</strong>
            <span>{account?.email}</span>
          </div>
          <button
            type="button"
            className="btn-icon btn-ghost"
            title="تسجيل خروج"
            onClick={logout}
            style={{ width: 28, height: 28 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
