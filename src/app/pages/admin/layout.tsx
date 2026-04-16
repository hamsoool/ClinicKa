import { Outlet, useLocation, useNavigate } from 'react-router';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  ArrowLeft,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  Users,
  UserCog,
  X,
  User,
  Camera,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/settings', label: 'System Settings', icon: Settings },
    { path: '/admin/staff', label: 'Clinic Staff', icon: UserCog },
    { path: '/admin/users', label: 'User Accounts', icon: Users },
    { path: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-primary text-white"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Close admin navigation menu' : 'Open admin navigation menu'}
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-sidebar text-sidebar-foreground
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative group">
                <div className="w-12 h-12 rounded-full border bg-muted flex items-center justify-center overflow-hidden">
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <label htmlFor="admin-profile-upload" className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera className="w-5 h-5" />
                </label>
                <input
                  id="admin-profile-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload admin profile picture"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setProfilePic(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold">Admin Portal</h2>
                <p className="text-sm opacity-90">{me?.profile.email || 'Health Services'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="mt-4 text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => {
                        navigate(item.path);
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-colors
                        ${active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="text-sm opacity-75">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <p>Administrator Portal</p>
              </div>
              <p className="text-xs mt-1">v1.0.0</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 pb-20">
          <Outlet />
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="grid grid-cols-4 px-2 py-2 pb-[env(safe-area-inset-bottom)]">
          {[
            { path: '/admin', label: 'Home', icon: LayoutDashboard },
            { path: '/admin/staff', label: 'Staff', icon: UserCog },
            { path: '/admin/users', label: 'Users', icon: Users },
            { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
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
