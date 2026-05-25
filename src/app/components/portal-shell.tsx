import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Camera, KeyRound, LogOut, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';
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
  if (path === '/student' || path === '/staff' || path === '/admin') {
    return pathname === path;
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
  brandTitle = 'Gordon College',
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
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(initialProfileImageUrl || null);
  const [brandImageFailed, setBrandImageFailed] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const currentPage = navItems.find((item) => isRouteActive(location.pathname, item.path))?.label || portalLabel;

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
    await logout();
    navigate('/');
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
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4fcf2_45%,#eef6ec_100%)]">
      <a
        href="#portal-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
      >
        Skip to main content
      </a>

      <aside
        id="portal-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-emerald-950/40 bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200',
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label={`${portalLabel} navigation`}
      >
        <div className="flex h-full flex-col px-4 py-6">
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

            <div className="rounded-lg border border-white/10 bg-white/5 p-4 shadow-[0_12px_24px_rgba(0,0,0,0.16)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-emerald-300/30 bg-emerald-50 text-primary">
                  {brandImageSrc && !brandImageFailed ? (
                    <img
                      src={brandImageSrc}
                      alt={`${brandTitle} logo`}
                      className="h-full w-full object-cover"
                      onError={() => setBrandImageFailed(true)}
                    />
                  ) : (
                    <BrandIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold tracking-tight text-white">{brandTitle}</h2>
                  <p className="truncate text-xs font-medium tracking-[0.18em] text-emerald-200/80">
                    {brandSubtitle}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-black/10 p-3">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="mt-1 truncate text-xs text-emerald-100/80">{profileSubtitle}</p>
                {email ? <p className="mt-1 truncate text-xs text-emerald-100/60">{email}</p> : null}
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
                        "relative flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium tracking-tight outline-none transition-all focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-inset",
                        active
                          ? "bg-emerald-800 text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-emerald-300 before:content-['']"
                          : 'text-emerald-100/70 hover:bg-emerald-800/50 hover:text-white',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 text-left">
                        <span className="block truncate">{item.label}</span>
                        {item.subLabel ? (
                          <span
                            className={cn(
                              'mt-0.5 block truncate text-[11px] font-semibold leading-tight',
                              active ? 'text-emerald-100/90' : 'text-emerald-100/55',
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
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-emerald-100/70 outline-none transition-colors hover:bg-emerald-800/50 hover:text-white focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-inset"
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

      <header className="fixed left-0 right-0 top-0 z-30 h-[4.5rem] border-b border-outline-variant/40 bg-white/90 backdrop-blur md:left-72 md:h-16">
        <div className="flex h-full items-center justify-between gap-2 px-4 md:gap-3 md:px-8">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[10px] font-semibold tracking-[0.14em] text-on-surface-variant sm:text-xs sm:tracking-[0.18em]">
                <span className="sm:hidden">{brandSubtitle}</span>
                <span className="hidden uppercase sm:inline">Clinic Management System</span>
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold leading-tight text-on-surface sm:text-[15px]">{currentPage}</p>
              {roleBadge ? (
                <span className="hidden rounded-full bg-primary-container/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-primary-container sm:inline-flex">
                  {roleBadge}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            {topActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface sm:h-10 sm:w-10"
                  onClick={() => {
                    if (action.path) navigate(action.path);
                    action.onClick?.();
                  }}
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              );
            })}

            {topBarSlot}

            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="ml-0.5 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-outline-variant/70 bg-surface-container-lowest shadow-sm sm:ml-1 sm:h-10 sm:w-10"
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                {profileAvatar}
              </button>

              {profileOpen ? (
                <div
                  className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-xl"
                  role="dialog"
                  aria-label="Profile menu"
                >
                  <div className="flex items-center gap-3">
                    <div className="group relative">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
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
                      <p className="truncate font-semibold text-on-surface">{displayName}</p>
                      {email ? <p className="truncate text-xs text-on-surface-variant">{email}</p> : null}
                      <p className="mt-1 truncate text-xs text-on-surface-variant">{profileSubtitle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(getPasswordSettingsPath());
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-outline-variant/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-container-low"
                  >
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOutOpen(true)}
                    className="mt-2 w-full rounded-md border border-outline-variant/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-container-low"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main id="portal-content" className="pt-20 outline-none md:pl-72" tabIndex={-1}>
        <div className="px-4 pb-28 md:px-8 md:pb-24">
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-outline-variant/40 bg-surface-container-lowest/95 backdrop-blur md:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className="grid gap-1 px-1.5 py-2"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
          }}
        >
          {navItems.map((item) => {
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
                  'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] leading-tight transition-colors sm:text-xs',
                  emphasized
                    ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                    : active
                      ? 'bg-primary-container/25 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-low',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="w-full truncate text-center">{item.mobileLabel}</span>
              </button>
            );
          })}
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
    </div>
  );
}
