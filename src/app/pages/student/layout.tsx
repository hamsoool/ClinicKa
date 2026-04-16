import { Outlet, useLocation, useNavigate } from 'react-router';
import { useState } from 'react';
import { Home, ClipboardList, FilePlus, FileCheck2, User, Menu, X, Camera, Award } from 'lucide-react';
import { useAuth } from '../../lib/auth';

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const isActive = (path: string) => {
    if (path === '/student') {
      return location.pathname === '/student';
    }
    return location.pathname.startsWith(path);
  };

  const topNavItems = [
    { path: '/student', label: 'Dashboard', icon: Home },
    { path: '/student/records', label: 'Record History', icon: ClipboardList },
    { path: '/student/year-selection', label: 'Submit Record', icon: FilePlus },
    { path: '/student/requirements', label: 'Requirements', icon: FileCheck2 },
    { path: '/student/certificate', label: 'Certificate', icon: Award },
  ];

  return (
    <div className="flex h-screen bg-background">
      <button
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-md bg-primary text-white"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Close student navigation menu' : 'Open student navigation menu'}
      >
        {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ease-in-out ${menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-sidebar-border">
            <h2 className="text-xl font-bold">Gordon College</h2>
            <p className="text-sm opacity-90">Student Portal</p>
          </div>

          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {topNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => {
                        navigate(item.path);
                        setMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="px-4 md:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Gordon College Health Services
                </p>
                <h1 className="text-lg font-semibold">Student Portal</h1>
                <p className="text-xs text-muted-foreground">
                  {me?.student?.student_id || me?.profile.student_id} {me?.student?.course ? `• ${me.student.course}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="w-10 h-10 rounded-full border bg-muted flex items-center justify-center overflow-hidden">
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <label htmlFor="profile-upload" className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera className="w-4 h-4" />
                  </label>
                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload student profile picture"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setProfilePic(URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 pb-20">
          <Outlet />
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="grid grid-cols-5 px-2 py-2 pb-[env(safe-area-inset-bottom)]">
          {[
            { path: '/student', label: 'Home', icon: Home },
            { path: '/student/records', label: 'Records', icon: ClipboardList },
            { path: '/student/year-selection', label: 'Submit', icon: FilePlus },
            { path: '/student/requirements', label: 'Reqs', icon: FileCheck2 },
            { path: '/student/certificate', label: 'Cert', icon: Award },
          ].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 rounded-md py-2 text-xs transition-colors ${active ? 'text-primary' : 'text-muted-foreground'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
