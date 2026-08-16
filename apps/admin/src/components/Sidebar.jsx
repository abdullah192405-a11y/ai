import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Server,
  Brain,
  HeadphonesIcon,
  LogOut,
  Shield,
  Key,
  UserCircle,
  ShieldAlert,
  ScrollText,
  Settings,
  Megaphone,
  Globe,
} from 'lucide-react';
import { auth } from '../api';

const nav = [
  { section: 'المنصة' },
  { to: '/', icon: LayoutDashboard, label: 'نظرة عامة', end: true },
  { to: '/tenants', icon: Users, label: 'المشتركون' },
  { to: '/users', icon: UserCircle, label: 'المستخدمون' },
  { to: '/revenue', icon: DollarSign, label: 'الإيرادات' },
  { section: 'البنية التحتية' },
  { to: '/system', icon: Server, label: 'صحة النظام', dot: true },
  { to: '/ai-models', icon: Brain, label: 'نماذج AI' },
  { to: '/api-keys', icon: Key, label: 'مفاتيح API' },
  { to: '/crawl-jobs', icon: Globe, label: 'عمليات الزحف' },
  { section: 'الأمان والإشراف' },
  { to: '/moderation', icon: ShieldAlert, label: 'إدارة المحتوى' },
  { to: '/audit-log', icon: ScrollText, label: 'سجل التدقيق' },
  { section: 'العمليات' },
  { to: '/support', icon: HeadphonesIcon, label: 'تذاكر الدعم' },
  { to: '/announcements', icon: Megaphone, label: 'الإعلانات' },
  { to: '/settings', icon: Settings, label: 'إعدادات المنصة' },
];

function initials(name, email) {
  const base = name || email || '?';
  return base
    .split(/[\s@]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar() {
  const user = auth.user;

  const logout = () => {
    auth.clear();
    window.location.reload();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={18} />
        </div>
        <h1>
          WBA Admin<small>لوحة تحكم المشرف</small>
        </h1>
      </div>

      <nav className="sidebar-nav">
        {nav.map((item, i) =>
          item.section ? (
            <div key={i} className="sidebar-divider">
              {item.section}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <item.icon size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.count && <span className="sidebar-count">{item.count}</span>}
              {item.dot && <span className="new-dot" />}
            </NavLink>
          )
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials(user?.fullName, user?.email)}</div>
          <div className="sidebar-user-meta">
            <strong>{user?.fullName || 'مشرف'}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            type="button"
            className="btn-icon btn-ghost"
            title="تسجيل خروج"
            style={{ width: 28, height: 28 }}
            onClick={logout}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
