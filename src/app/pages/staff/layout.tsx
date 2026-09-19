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
import { prefetchPortalExperience } from '../../lib/login-prefetch';
import { useAuth } from '../../lib/auth';
import { getRoleLabel, isDoctorPosition } from '../../lib/api';

const navItems = [
  { path: '/staff/submissions', label: 'Review Queue', mobileLabel: 'Queue', icon: ClipboardCheck },
  { path: '/staff/dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', icon: Home },
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

  const rawDisplayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    getRoleLabel(me?.profile?.role, me?.staff?.position);
  const isDoctor = isDoctorPosition(me?.staff?.position);
  const displayName = isDoctor && rawDisplayName && !rawDisplayName.startsWith('Dr. ')
    ? `Dr. ${rawDisplayName}`
    : rawDisplayName;
  const position = getRoleLabel(me?.profile?.role, me?.staff?.position);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
      const callbackId = window.requestIdleCallback(() => {
        prefetchPortalExperience('staff', me);
      });
      return () => window.cancelIdleCallback?.(callbackId);
    }
    const timerId = window.setTimeout(() => prefetchPortalExperience('staff', me), 250);
    return () => window.clearTimeout(timerId);
  }, [me]);

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Clinic Operations Portal"
      brandTitle="ClinicKa!"
      brandSubtitle="GC Health Services Unit"
      brandIcon={Stethoscope}
      brandImageSrc="/clinickalogo.png"
      displayName={displayName}
      profileSubtitle={position}
      initials={getInitials(displayName, 'CL')}
      profileUploadId="clinic-profile-upload"
      profileUploadLabel="Upload clinic staff profile picture"
      topActions={topActions}
    />
  );
}
