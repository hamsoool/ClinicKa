import { useEffect } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  UserRoundCog,
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
  {
    path: '/super-admin',
    label: 'Administrators',
    subLabel: 'Add or remove system admins',
    mobileLabel: 'Admins',
    icon: UserRoundCog,
    mobileEmphasis: true,
  },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'Administrator access', icon: ShieldCheck, path: '/super-admin' },
] as const satisfies readonly PortalTopAction[];

export default function SuperAdminLayout() {
  const { me } = useAuth();

  const displayName =
    [me?.profile.first_name || '', me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    'Super Administrator';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
      const callbackId = window.requestIdleCallback(() => {
        prefetchPortalRoutes('super_admin');
      });
      return () => window.cancelIdleCallback?.(callbackId);
    }
    const timerId = window.setTimeout(() => prefetchPortalRoutes('super_admin'), 250);
    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Super Admin Console"
      brandSubtitle="ClinicKa!"
      brandIcon={ShieldPlus}
      brandImageSrc="/gchsu.png"
      displayName={displayName}
      profileSubtitle="Super Administrator"
      email={me?.profile.email || undefined}
      initials={getInitials(displayName, 'SA')}
      roleBadge="Administrator Access"
      profileUploadId="super-admin-profile-upload"
      profileUploadLabel="Upload super admin profile picture"
      topActions={topActions}
    />
  );
}
