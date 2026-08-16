import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Palette,
  Settings,
  Plug,
  Globe,
} from 'lucide-react';

export { PLAN_LABELS, PLAN_CATALOG } from '@wba/plans';

export const ROLE_LABELS = {
  tenant_owner: 'مالك',
  tenant_admin: 'مدير',
  tenant_editor: 'محرر',
  tenant_viewer: 'مشاهد',
};

/** Short nav — one website per account. */
export function buildNav(hasWebsite) {
  const websites = { to: '/websites', icon: Globe, label: 'المواقع' };
  const settings = { to: '/settings', icon: Settings, label: 'الإعدادات' };

  if (!hasWebsite) {
    return [websites, settings];
  }

  return [
    { to: '/overview', icon: LayoutDashboard, label: 'الرئيسية' },
    websites,
    { to: '/knowledge-base', icon: BookOpen, label: 'علّم المساعد' },
    { to: '/install', icon: Plug, label: 'ثبّت على الموقع' },
    { to: '/customize', icon: Palette, label: 'شكل المساعد' },
    { to: '/conversations', icon: MessageSquare, label: 'المحادثات' },
    settings,
  ];
}
