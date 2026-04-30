import {
  Activity,
  Award,
  Bell,
  ClipboardCheck,
  FileText,
  Home,
  Settings,
  ShieldPlus,
  Stethoscope,
} from 'lucide-react';
import PortalShell, {
  formatEmailName,
  getInitials,
  type PortalNavItem,
  type PortalTopAction,
} from '../../components/portal-shell';
import { useAuth } from '../../lib/auth';

const navItems = [
  { path: '/staff', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/staff/submissions', label: 'Review Queue', mobileLabel: 'Queue', icon: ClipboardCheck },
  { path: '/staff/records', label: 'Records Archive', mobileLabel: 'Records', icon: FileText },
  { path: '/staff/reports', label: 'Reports', mobileLabel: 'Reports', icon: Activity },
  { path: '/staff/certificates', label: 'Certificates', mobileLabel: 'Certs', icon: Award },
  { path: '/staff/settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'Notifications', icon: Bell },
  { label: 'Clinic safeguards', icon: ShieldPlus },
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
    'Clinic Nurse / Doctor';
  const position = me?.staff?.position || 'Clinic Nurse / Doctor';
  const email = me?.profile.email || 'clinic.staff@gordoncollege.edu.ph';

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Clinic Operations Portal"
      brandSubtitle="Clinic Operations"
      brandIcon={Stethoscope}
      brandImageSrc="/gchsu.png"
      displayName={displayName}
      profileSubtitle={position}
      email={email}
      initials={getInitials(displayName, 'CL')}
      roleBadge={position}
      profileUploadId="clinic-profile-upload"
      profileUploadLabel="Upload clinic staff profile picture"
      topActions={topActions}
    />
  );
}
