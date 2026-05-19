import { useEffect } from 'react';
import {
  Activity,
  ClipboardCheck,
  FileText,
  Home,
  Megaphone,
  Settings,
  Stethoscope,
} from 'lucide-react';
import PortalShell, {
  formatEmailName,
  getInitials,
  type PortalNavItem,
  type PortalTopAction,
} from '../../components/portal-shell';
import { prefetchPortalRoutes } from '../../route-modules';
import { useAuth } from '../../lib/auth';
import { getRoleLabel } from '../../lib/api';

const navItems = [
  { path: '/staff', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/staff/submissions', label: 'Review Queue', mobileLabel: 'Queue', icon: ClipboardCheck },
  { path: '/staff/records', label: 'Records & Certificates', mobileLabel: 'Records', icon: FileText },
  { path: '/staff/reports', label: 'Reports', mobileLabel: 'Reports', icon: Activity },
  { path: '/staff/announcements', label: 'Announcements', mobileLabel: 'Posts', icon: Megaphone },
  { path: '/staff/settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'Staff settings', icon: Settings, path: '/staff/settings' },
] as const satisfies readonly PortalTopAction[];

export default function StaffLayout() {
  const { me } = useAuth();

  const displayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    getRoleLabel(me?.profile?.role, me?.staff?.position);
  const position = getRoleLabel(me?.profile?.role, me?.staff?.position);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
      const callbackId = window.requestIdleCallback(() => {
        prefetchPortalRoutes('staff');
      });
      return () => window.cancelIdleCallback?.(callbackId);
    }
    const timerId = window.setTimeout(() => prefetchPortalRoutes('staff'), 250);
    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Clinic Operations Portal"
      brandSubtitle="ClinicKa!"
      brandIcon={Stethoscope}
      brandImageSrc="/gchsu.png"
      displayName={displayName}
      profileSubtitle={position}
      initials={getInitials(displayName, 'CL')}
      roleBadge="Gordon College Health Services"
      profileUploadId="clinic-profile-upload"
      profileUploadLabel="Upload clinic staff profile picture"
      topActions={topActions}
    />
  );
}
