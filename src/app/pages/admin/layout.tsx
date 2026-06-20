import { useEffect } from 'react';
import {
  BarChart3,
  Home,
  Megaphone,
  Settings,
  ShieldCheck,
  ShieldPlus,
  Users,
} from 'lucide-react';
import PortalShell, {
  formatEmailName,
  getInitials,
  type PortalNavItem,
  type PortalTopAction,
} from '../../components/portal-shell';
import { prefetchPortalRoutes } from '../../route-modules';
import { useAuth } from '../../lib/auth';

const navItems = [
  { path: '/admin', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/admin/reports', label: 'Reports', mobileLabel: 'Reports', icon: BarChart3 },
  { path: '/admin/users', label: 'User Accounts', mobileLabel: 'Users', icon: Users },
  { path: '/admin/announcements', label: 'Announcements', mobileLabel: 'Posts', icon: Megaphone },
  { path: '/admin/settings', label: 'System Settings', mobileLabel: 'Settings', icon: Settings },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'System safeguards', icon: ShieldPlus },
  { label: 'System settings', icon: Settings, path: '/admin/settings' },
] as const satisfies readonly PortalTopAction[];

export default function AdminLayout() {
  const { me } = useAuth();

  const displayName =
    [me?.profile.first_name || '', me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    'System Administrator';
  const roleLabel = 'System Administrator';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
      const callbackId = window.requestIdleCallback(() => {
        prefetchPortalRoutes('admin');
      });
      return () => window.cancelIdleCallback?.(callbackId);
    }
    const timerId = window.setTimeout(() => prefetchPortalRoutes('admin'), 250);
    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Admin Control Center"
      brandTitle="ClinicKa!"
      brandSubtitle="GC Health Services Unit"
      brandIcon={ShieldCheck}
      brandImageSrc="/clinickalogo.png"
      displayName={displayName}
      profileSubtitle={roleLabel}
      initials={getInitials(displayName, 'AD')}
      profileUploadId="admin-profile-upload"
      profileUploadLabel="Upload admin profile picture"
      topActions={topActions}
    />
  );
}
