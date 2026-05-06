import { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  ClipboardList,
  FileCheck2,
  FilePlus,
  HelpCircle,
  Home,
  User,
} from 'lucide-react';
import PortalShell, {
  getInitials,
  type PortalNavItem,
  type PortalTopAction,
} from '../../components/portal-shell';
import { getStudentProfilePhoto } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const navItems = [
  { path: '/student', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/student/records', label: 'Record History', mobileLabel: 'Records', icon: ClipboardList },
  { path: '/student/year-selection', label: 'Submit Record', mobileLabel: 'Submit', icon: FilePlus },
  { path: '/student/requirements', label: 'Requirements', mobileLabel: 'Reqs', icon: FileCheck2 },
  { path: '/student/certificate', label: 'Certificate', mobileLabel: 'Cert', icon: Award },
  { path: '/student/profile', label: 'Profile', mobileLabel: 'Profile', icon: User },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'Notifications', icon: Bell },
  { label: 'Profile settings', icon: User, path: '/student/profile' },
  { label: 'Requirements help', icon: HelpCircle, path: '/student/requirements' },
] as const satisfies readonly PortalTopAction[];

export default function StudentLayout() {
  const { me } = useAuth();
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const displayName = [
    me?.student?.first_name || me?.profile.first_name || '',
    me?.student?.last_name || me?.profile.last_name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Student';

  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  const course = me?.student?.course || me?.profile.course || '';
  const profileSubtitle = [studentId, course].filter(Boolean).join(' | ') || 'Student account';

  useEffect(() => {
    const profileStudentId = me?.student?.student_id || me?.profile.student_id || '';
    if (!profileStudentId) {
      setProfilePic(null);
      return;
    }

    let active = true;

    const loadProfilePhoto = async () => {
      try {
        const { photoUrl } = await getStudentProfilePhoto(profileStudentId);
        if (active) setProfilePic(photoUrl || null);
      } catch {
        if (active) setProfilePic(null);
      }
    };

    void loadProfilePhoto();

    const handleProfileAssetUpdate = () => {
      void loadProfilePhoto();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('gc-profile-assets-updated', handleProfileAssetUpdate as EventListener);
    }

    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('gc-profile-assets-updated', handleProfileAssetUpdate as EventListener);
      }
    };
  }, [me?.student?.student_id, me?.profile.student_id]);

  return (
    <PortalShell
      navItems={navItems}
      portalLabel="Student Portal"
      brandSubtitle="ClinicKa!"
      brandIcon={FileCheck2}
      brandImageSrc="/gchsu.png"
      displayName={displayName}
      profileSubtitle={profileSubtitle}
      initials={getInitials(displayName, 'ST')}
      roleBadge="Gordon College Health Services"
      initialProfileImageUrl={profilePic}
      profileUploadId="student-profile-upload"
      profileUploadLabel="Upload student profile picture"
      topActions={topActions}
    />
  );
}
