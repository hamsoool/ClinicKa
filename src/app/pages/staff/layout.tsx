import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
  Activity,
  Award,
  Bell,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Settings,
  ShieldPlus,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

const navItems = [
  { path: '/staff', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
  { path: '/staff/submissions', label: 'Review Queue', mobileLabel: 'Queue', icon: ClipboardCheck },
  { path: '/staff/records', label: 'Records Archive', mobileLabel: 'Records', icon: FileText },
  { path: '/staff/reports', label: 'Reports', mobileLabel: 'Reports', icon: Activity },
  { path: '/staff/certificates', label: 'Certificates', mobileLabel: 'Certs', icon: Award },
  { path: '/staff/settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings },
] as const;

function formatEmailName(email?: string | null) {
  if (!email) return '';

  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const displayName =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() ||
    formatEmailName(me?.profile.email) ||
    'Clinic Nurse / Doctor';
  const position = me?.staff?.position || 'Clinic Nurse / Doctor';
  const email = me?.profile.email || 'clinic.staff@gordoncollege.edu.ph';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isActive = (path: string) => {
    if (path === '/staff') {
      return location.pathname === '/staff';
    }

    return location.pathname.startsWith(path);
  };

  const currentPage = navItems.find((item) => isActive(item.path))?.label || 'Clinic Operations Portal';

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4fcf2_45%,#eef6ec_100%)]">
      <button
        className="fixed left-4 top-4 z-50 rounded-xl bg-primary px-3 py-2 text-white shadow-lg md:hidden"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={menuOpen ? 'Close clinic navigation menu' : 'Open clinic navigation menu'}
      >
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-emerald-950/40 bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col px-4 py-6">
          <div className="px-2 pb-6">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 shadow-[0_12px_24px_rgba(0,0,0,0.16)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-50 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">Gordon College</h2>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-200/80">
                    Clinic Operations
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-black/10 p-3">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="mt-1 text-xs text-emerald-100/80">{position}</p>
                <p className="mt-1 truncate text-xs text-emerald-100/60">{email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-2">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <li key={item.path}>
                    <button
                      onClick={() => goTo(item.path)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium tracking-tight transition-all ${
                        active
                          ? 'border-l-4 border-emerald-300 bg-emerald-800 text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]'
                          : 'text-emerald-100/70 hover:bg-emerald-800/50 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto px-2 pt-4">
            <div className="space-y-2 border-t border-white/10 pt-4">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-emerald-100/70 transition-colors hover:bg-emerald-800/50 hover:text-white"
              >
                <HelpCircle className="h-5 w-5" />
                <span>Help Center</span>
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-emerald-100/70 transition-colors hover:bg-emerald-800/50 hover:text-white"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMenuOpen(false)} />
      ) : null}

      <header className="fixed left-0 right-0 top-0 z-30 h-16 border-b border-outline-variant/40 bg-white/85 backdrop-blur md:left-72">
        <div className="flex h-full items-center justify-between px-4 md:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
              Clinic Management System
            </p>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-on-surface">{currentPage}</p>
              <span className="hidden rounded-full bg-primary-container/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-primary-container sm:inline-flex">
                {position}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low">
              <Bell className="h-5 w-5" />
            </button>
            <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low">
              <ShieldPlus className="h-5 w-5" />
            </button>
            <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low">
              <HelpCircle className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="ml-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-outline-variant/70 bg-surface-container-lowest shadow-sm"
                aria-label="Open clinic profile menu"
              >
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-on-surface-variant">{initials || 'CL'}</span>
                )}
              </button>
              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="group relative">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
                        {profilePic ? (
                          <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-on-surface-variant">
                            {initials || 'CL'}
                          </span>
                        )}
                      </div>
                      <label
                        htmlFor="clinic-profile-upload"
                        className="absolute inset-0 cursor-pointer rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <span className="flex h-full w-full items-center justify-center text-white">
                          <UserRound className="h-4 w-4" />
                        </span>
                      </label>
                      <input
                        id="clinic-profile-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label="Upload clinic staff profile picture"
                        onChange={(event) => {
                          if (event.target.files && event.target.files[0]) {
                            setProfilePic(URL.createObjectURL(event.target.files[0]));
                          }
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-on-surface">{displayName}</p>
                      <p className="truncate text-xs text-on-surface-variant">{email}</p>
                      <p className="mt-1 truncate text-xs text-on-surface-variant">{position}</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      navigate('/');
                    }}
                    className="mt-4 w-full rounded-xl border border-outline-variant/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-container-low"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-20 md:pl-72">
        <div className="px-4 pb-20 md:px-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-outline-variant/40 bg-surface-container-lowest/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 px-2 py-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 rounded-md py-2 text-xs transition-colors ${
                  active ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
