import { useEffect } from 'react';
import {
  ShieldPlus,
  UserRoundCog,
} from 'lucide-react';
import PortalShell, {
  formatEmailName,
  getInitials,
  type PortalNavItem,
} from '../../components/portal-shell';
import { prefetchPortalRoutes } from '../../route-modules';
import { useAuth } from '../../lib/auth';

const navItems = [
  {
    path: '/super-admin',
    label: 'Administrators',
    mobileLabel: 'Admins',
    icon: UserRoundCog,
    mobileEmphasis: true,
  },
] as const satisfies readonly PortalNavItem[];

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
      brandTitle="ClinicKa!"
      brandSubtitle="GC Health Services Unit"
      brandIcon={ShieldPlus}
      brandImageSrc="/clinickalogo.png"
      displayName={displayName}
      profileSubtitle="Super Administrator"
      email={me?.profile.email || undefined}
      initials={getInitials(displayName, 'SA')}
      roleBadge="Administrator Access"
      profileUploadId="super-admin-profile-upload"
      profileUploadLabel="Upload super admin profile picture"
    />
  );
}
