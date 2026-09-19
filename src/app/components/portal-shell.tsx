import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSwipeNavigation } from '../lib/use-swipe-navigation';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Camera, KeyRound, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LogoutBlockedError, useAuth } from '../lib/auth';
import FilePickerButton from './file-picker-button';
import { cn } from './ui/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export type PortalNavItem = {
  path: string;
  label: string;
  subLabel?: string;
  mobileLabel: string;
  icon: LucideIcon;
  mobileEmphasis?: boolean;
};

export type PortalTopAction = {
  label: string;
  icon: LucideIcon;
  path?: string;
  onClick?: () => void;
};

type PortalShellProps = {
  navItems: readonly PortalNavItem[];
  portalLabel: string;
  brandTitle?: string;
  brandSubtitle: string;
  brandIcon: LucideIcon;
  brandImageSrc?: string;
  displayName: string;
  profileSubtitle: string;
  email?: string;
  initials: string;
  roleBadge?: string;
  initialProfileImageUrl?: string | null;
  profileUploadId: string;
  profileUploadLabel: string;
  topActions?: readonly PortalTopAction[];
  topBarSlot?: ReactNode;
};

function isRouteActive(pathname: string, path: string) {
  if (path === '/student' || path === '/staff/dashboard' || path === '/admin') {
    return pathname === path;
  }

  if (path === '/staff/submissions') {
    return (
      pathname === '/staff' ||
      pathname === '/staff/submissions' ||
      pathname.startsWith('/staff/submissions') ||
      pathname.startsWith('/staff/review')
    );
  }

  if (path === '/student/year-selection') {
    return (
      pathname === path ||
      pathname.startsWith('/student/privacy-waiver') ||
      pathname.startsWith('/student/medical-form')
    );
  }

  return pathname.startsWith(path);
}

export function formatEmailName(email?: string | null) {
  if (!email) return '';

  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getInitials(name: string, fallback = 'GC') {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || fallback;
}

export default function PortalShell({
  navItems,
  portalLabel,
  brandTitle = 'ClinicKa!',
  brandSubtitle,
  brandIcon: BrandIcon,
  brandImageSrc,
  displayName,
  profileSubtitle,
  email,
  initials,
  roleBadge,
  initialProfileImageUrl,
  profileUploadId,
  profileUploadLabel,
  topActions = [],
  topBarSlot,
}: PortalShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, pendingStaffClearanceCount, pendingUploadCount } = useAuth();
  const swipeContentRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(initialProfileImageUrl || null);
  const [brandImageFailed, setBrandImageFailed] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [logoutBlockedOpen, setLogoutBlockedOpen] = useState(false);
  const [logoutBlockedReason, setLogoutBlockedReason] = useState<'staff_clearance' | 'upload_in_progress'>('staff_clearance');
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useSwipeNavigation(navItems, swipeContentRef);

  const currentPage = navItems.find((item) => isRouteActive(location.pathname, item.path))?.label || portalLabel;

  const showMoreInBottomNav = navItems.length > 5;
  const bottomNavItems = showMoreInBottomNav ? navItems.slice(0, 4) : navItems;

  const getPasswordSettingsPath = () => {
    if (location.pathname.startsWith('/student')) return '/student/profile#password';
    if (location.pathname.startsWith('/staff')) return '/staff/settings#password';
    if (location.pathname.startsWith('/super-admin')) return '/super-admin#password';
    if (location.pathname.startsWith('/admin')) return '/admin/settings#password';
    return '/';
  };

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    if (!id) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);

  useEffect(() => {
    if (!objectUrlRef.current) {
      setProfilePic(initialProfileImageUrl || null);
    }
  }, [initialProfileImageUrl]);

  useEffect(() => {
    setBrandImageFailed(false);
  }, [brandImageSrc]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setProfileOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (profileMenuRef.current?.contains(event.target as Node)) return;
      setProfileOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [profileOpen]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      if (error instanceof LogoutBlockedError) {
        setConfirmSignOutOpen(false);
        setLogoutBlockedReason(error.reason);
        setLogoutBlockedOpen(true);
        return;
      }

      toast.error(error instanceof Error ? error.message : 'Unable to log out right now.');
    }
  };

  const handleProfileUpload = (file: File | null) => {
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    objectUrlRef.current = URL.createObjectURL(file);
    setProfilePic(objectUrlRef.current);
  };

  const profileAvatar = profilePic ? (
    <img src={profilePic} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="text-xs font-bold text-on-surface-variant">{initials}</span>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-background print:bg-white">
      <a
        href="#portal-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
      >
        Skip to main content
      </a>

      <aside
        id="portal-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-80 overflow-y-auto border-r border-emerald-950/25 bg-sidebar text-sidebar-foreground transition-transform duration-200 print:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label={`${portalLabel} navigation`}
      >
        <div className="flex min-h-full flex-col px-4 py-6">
          <div className="px-2 pb-6">
            <div className="mb-4 flex items-center justify-end md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/15"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible text-primary">
                  {brandImageSrc && !brandImageFailed ? (
                    <img
                      src={brandImageSrc}
                      alt={`${brandTitle} logo`}
                      className="h-full w-full object-contain"
                      onError={() => setBrandImageFailed(true)}
                    />
                  ) : (
                    <BrandIcon className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold tracking-[-0.02em] text-white">{brandTitle}</h2>
                  <p className="text-xs font-semibold leading-tight tracking-[0.08em] text-emerald-200/90 whitespace-normal">
                    {brandSubtitle}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[14px] bg-black/10 p-3.5">
                <p className="truncate text-base font-bold text-white">{displayName}</p>
                <p className="mt-1 truncate text-sm text-emerald-100/80">{profileSubtitle}</p>
                {email ? <p className="mt-1 truncate text-xs sm:text-sm text-emerald-100/70">{email}</p> : null}
              </div>
            </div>
          </div>

          <nav className="flex-1 px-2" aria-label="Primary">
            <ul className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(location.pathname, item.path);

                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => goTo(item.path)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        "relative flex min-h-13 w-full items-center gap-3 rounded-full px-4 py-3 text-base font-medium tracking-[-0.01em] outline-none transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-inset",
                        active
                          ? "bg-white/14 text-white before:absolute before:inset-y-3 before:left-0 before:w-1.5 before:rounded-r-full before:bg-emerald-200 before:content-['']"
                          : 'text-emerald-100/75 hover:bg-emerald-800/50 hover:text-white',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 text-left">
                        <span className="block truncate">{item.label}</span>
                        {item.subLabel ? (
                          <span
                            className={cn(
                              'mt-0.5 block truncate text-xs font-semibold leading-tight',
                              item.subLabel.toLowerCase().includes('danger')
                                ? 'text-rose-300'
                                : active
                                  ? 'text-emerald-100/90'
                                  : 'text-emerald-100/65',
                            )}
                          >
                            {item.subLabel}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto px-2 pt-4">
            <div className="space-y-1.5 border-t border-white/10 pt-4">
              <button
                type="button"
                className="flex min-h-13 w-full items-center gap-3 rounded-full px-4 py-3 text-base font-medium text-emerald-100/75 outline-none transition-all active:scale-[0.98] hover:bg-emerald-800/50 hover:text-white focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-inset"
                onClick={() => setConfirmSignOutOpen(true)}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation overlay"
        />
      ) : null}

      <header className="fixed left-0 right-0 top-0 z-30 h-[4.75rem] border-b border-outline-variant/55 bg-background/85 backdrop-blur-xl md:left-80 md:h-18 print:hidden">
        <div className="flex h-full items-center justify-between gap-2 px-4 md:gap-3 md:px-8">


          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-xs font-medium tracking-wider text-neutral-500 sm:text-sm">
                <span className="uppercase">Medical Clearance and Health Record Management System</span>
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-lg font-bold leading-tight text-neutral-900 sm:text-xl">{currentPage}</p>
              {roleBadge ? (
                <span className="hidden rounded-full bg-primary-container/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-primary-container sm:inline-flex">
                  {roleBadge}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {topActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-all active:scale-95 hover:bg-surface-container-low hover:text-on-surface sm:h-11 sm:w-11"
                  onClick={() => {
                    if (action.path) navigate(action.path);
                    action.onClick?.();
                  }}
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              );
            })}

            {topBarSlot}

            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="ml-0.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-outline-variant/70 bg-surface-container-lowest sm:ml-1 sm:h-11 sm:w-11"
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                {profileAvatar}
              </button>

              {profileOpen ? (
                <div
                  className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-[18px] border border-outline-variant/55 bg-surface-container-lowest p-5"
                  role="dialog"
                  aria-label="Profile menu"
                >
                  <div className="flex items-center gap-3">
                    <div className="group relative">
                      <div className="flex h-15 w-15 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
                        {profileAvatar}
                      </div>
                      <FilePickerButton
                        accept="image/*,.heic,.heif"
                        ariaLabel={profileUploadLabel}
                        className="absolute inset-0 h-full rounded-full border-0 bg-black/50 p-0 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        inputClassName="rounded-full"
                        onFileSelected={handleProfileUpload}
                      >
                        <Camera className="h-4 w-4" />
                      </FilePickerButton>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-on-surface">{displayName}</p>
                      {email ? <p className="truncate text-sm text-on-surface-variant">{email}</p> : null}
                      <p className="mt-1 truncate text-sm text-on-surface-variant">{profileSubtitle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(getPasswordSettingsPath());
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2.5 text-base font-medium transition-colors hover:bg-surface-container-low"
                  >
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOutOpen(true)}
                    className="mt-2 w-full rounded-full border border-outline-variant/40 px-4 py-2.5 text-base font-medium transition-colors hover:bg-surface-container-low"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main id="portal-content" className="relative pt-24 outline-none overflow-x-hidden bg-background md:pl-80 print:p-0" tabIndex={-1}>
        <div ref={swipeContentRef} className="relative px-4 pb-36 sm:pb-40 md:px-8 md:pb-24 print:p-0">
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-outline-variant/60 bg-surface-container-lowest/95 backdrop-blur-xl shadow-lg md:hidden print:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className="grid gap-1 px-2 pt-2.5"
          style={{
            gridTemplateColumns: `repeat(${bottomNavItems.length + (showMoreInBottomNav ? 1 : 0)}, minmax(0, 1fr))`,
            paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0.75rem) + 0.5rem)',
          }}
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(location.pathname, item.path);
            const emphasized = item.mobileEmphasis;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goTo(item.path)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[66px] min-w-0 select-none touch-manipulation flex-col items-center justify-center gap-1.5 px-1.5 py-2 transition-all active:scale-95',
                  emphasized
                    ? '-translate-y-3 min-h-[70px] rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary/90 font-semibold'
                    : active
                      ? 'rounded-2xl bg-primary/10 font-semibold text-primary'
                      : 'rounded-2xl font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70',
                )}
              >
                <Icon className={cn('h-6 w-6 shrink-0', emphasized ? 'text-white' : active ? 'text-primary' : 'text-neutral-600')} />
                <span className={cn('w-full truncate text-center text-xs tracking-tight leading-tight', emphasized ? 'font-semibold text-white' : active ? 'font-semibold text-primary' : 'font-medium text-neutral-600')}>
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
          {showMoreInBottomNav ? (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex min-h-[66px] min-w-0 select-none touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2 text-xs font-medium leading-tight tracking-tight text-neutral-600 transition-all active:scale-95 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Menu className="h-6 w-6 shrink-0 text-neutral-600" />
              <span className="w-full truncate text-center">More</span>
            </button>
          ) : null}
        </div>
      </nav>

      <AlertDialog open={confirmSignOutOpen} onOpenChange={setConfirmSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of your account?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access the portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleSignOut();
              }}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={logoutBlockedOpen} onOpenChange={setLogoutBlockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {logoutBlockedReason === 'upload_in_progress'
                ? 'Upload still in progress'
                : 'Background clearance still in progress'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {logoutBlockedReason === 'upload_in_progress'
                ? pendingUploadCount > 1
                  ? `${pendingUploadCount} uploads are still in progress. Please wait until they finish before logging out.`
                  : 'A file upload is still in progress. Please wait until it finishes before logging out.'
                : pendingStaffClearanceCount > 1
                  ? `${pendingStaffClearanceCount} medical certificates are still being processed in the background. Please wait until they finish before logging out.`
                  : 'A medical certificate is still being processed in the background. Please wait until it finishes before logging out.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setLogoutBlockedOpen(false)}
              className="bg-primary text-white hover:bg-primary/90"
            >
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
