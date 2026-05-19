import { useEffect, useState } from 'react';
import {
  ClipboardList,
  FileCheck2,
  FilePlus,
  Home,
  Megaphone,
  User,
} from 'lucide-react';
import PortalShell, {
  getInitials,
  type PortalNavItem,
  type PortalTopAction,
} from '../../components/portal-shell';
import StudentNotificationMenu from '../../components/student-notification-menu';
import { prefetchPortalRoutes } from '../../route-modules';
import { getStudentProfilePhoto } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useStudentNotifications } from './student-notifications';

const navItems = [
  { path: '/student', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/student/clearance', label: 'Records & Clearance', mobileLabel: 'Records', icon: ClipboardList },
  { path: '/student/year-selection', label: 'Submit Record', mobileLabel: 'Submit', icon: FilePlus },
  { path: '/student/announcements', label: 'Announcements', mobileLabel: 'News', icon: Megaphone },
  { path: '/student/profile', label: 'Profile', mobileLabel: 'Profile', icon: User },
] as const satisfies readonly PortalNavItem[];

const topActions = [
  { label: 'Profile settings', icon: User, path: '/student/profile' },
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
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markNotificationAsRead,
    markNotificationAsUnread,
    deleteNotification,
    clearNotifications,
  } = useStudentNotifications(studentId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
      const callbackId = window.requestIdleCallback(() => {
        prefetchPortalRoutes('student');
      });
      return () => window.cancelIdleCallback?.(callbackId);
    }
    const timerId = window.setTimeout(() => prefetchPortalRoutes('student'), 250);
    return () => window.clearTimeout(timerId);
  }, []);

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
      topBarSlot={(
        <StudentNotificationMenu
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllAsRead={markAllAsRead}
          onMarkNotificationAsRead={markNotificationAsRead}
          onMarkNotificationAsUnread={markNotificationAsUnread}
          onDeleteNotification={deleteNotification}
          onClearNotifications={clearNotifications}
        />
      )}
    />
  );
}
