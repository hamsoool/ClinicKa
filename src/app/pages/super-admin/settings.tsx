import { ShieldCheck } from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';

export default function SuperAdminSettings() {
  return (
    <div className="w-full min-w-0 space-y-8">
      <PortalPageIntro
        title="Settings"
        description="Manage your account settings and preferences"
      />

      <div className="w-full space-y-8">
        <PasswordChangeCard />

        <div className="border-t border-border/40 pt-6">
          <SettingsLogoutCard />
        </div>
      </div>
    </div>
  );
}
