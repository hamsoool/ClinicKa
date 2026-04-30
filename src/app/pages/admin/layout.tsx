import {
  BarChart3,
  Bell,
  Home,
  Settings,
  ShieldCheck,
  ShieldPlus,
  UserCog,
  Users,
} from 'lucide-react';
import PortalShell, {
  formatEmailName,
  getInitials,
  type PortalNavItem,
  type PortalTopAction,
} from '../../components/portal-shell';
import { useAuth } from '../../lib/auth';

const navItems = [
  { path: '/admin', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/admin/settings', label: 'System Settings', mobileLabel: 'Settings', icon: Settings },
  { path: '/admin/staff', label: 'Clinic Staff', mobileLabel: 'Staff', icon: UserCog },
  { path: '/admin/users', label: 'User Accounts', mobileLabel: 'Users', icon: Users },
  { path: '/admin/reports', label: 'Reports', mobileLabel: 'Reports', icon: BarChart3 },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'Notifications', icon: Bell },
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
  const email = me?.profile.email || 'clinic.admin@gordoncollege.edu.ph';

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Admin Control Center"
      brandSubtitle="Admin Control"
      brandIcon={ShieldCheck}
      brandImageSrc="/gchsu.png"
      displayName={displayName}
      profileSubtitle={roleLabel}
      email={email}
      initials={getInitials(displayName, 'AD')}
      roleBadge={roleLabel}
      profileUploadId="admin-profile-upload"
      profileUploadLabel="Upload admin profile picture"
      topActions={topActions}
    />
  );
}
