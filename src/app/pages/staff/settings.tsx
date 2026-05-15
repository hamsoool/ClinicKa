import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import PasswordChangeCard from '../../components/password-change-card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/auth';
import { updateStaffProfile, getRoleLabel } from '../../lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Bell, Settings as SettingsIcon, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type StaffProfileFormState = {
  name: string;
  email: string;
  position: string;
  phone: string;
};

function normalizeProfileValue(value: string) {
  return value.trim();
}

function buildProfileFormState(me?: ReturnType<typeof useAuth>['me'] | null): StaffProfileFormState {
  const name =
    [me?.staff?.first_name || me?.profile.first_name || '', me?.staff?.last_name || me?.profile.last_name || '']
      .filter(Boolean)
      .join(' ')
      .trim() || '';

  return {
    name,
    email: me?.staff?.email || me?.profile.email || '',
    position: getRoleLabel(me?.profile?.role, me?.staff?.position),
    phone: me?.staff?.phone || '',
  };
}

export default function StaffSettings() {
  const { me, refresh } = useAuth();
  const initialProfileData = useMemo(() => buildProfileFormState(me), [me]);
  const [profile, setProfile] = useState<StaffProfileFormState>(initialProfileData);
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pendingReminders: true,
    weeklyReports: false,
  });
  const [system, setSystem] = useState({
    academicYear: '2025-2026',
    semester: 'Second Semester',
    maintenanceMode: false,
  });

  useEffect(() => {
    setProfile(initialProfileData);
  }, [initialProfileData]);

  const hasProfileChanges = useMemo(
    () =>
      (Object.keys(initialProfileData) as Array<keyof StaffProfileFormState>).some(
        (key) => normalizeProfileValue(profile[key]) !== normalizeProfileValue(initialProfileData[key]),
      ),
    [initialProfileData, profile],
  );

  const isProfileValid =
    Boolean(profile.name.trim()) && Boolean(profile.email.trim()) && Boolean(profile.position.trim());

  const updateProfileField = <K extends keyof StaffProfileFormState>(field: K, value: StaffProfileFormState[K]) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const requestSaveConfirmation = () => {
    if (!isProfileValid) {
      toast.error('Please complete name, email, and position before saving.');
      return;
    }
    if (!hasProfileChanges) {
      toast.info('No profile changes to save yet.');
      return;
    }
    setConfirmSaveOpen(true);
  };

  const handleProfileSave = async () => {
    setSavingProfile(true);
    try {
      await updateStaffProfile(profile);
      await refresh();
      setConfirmSaveOpen(false);
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile updates.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-on-surface">Settings</h1>
        <p className="max-w-2xl text-sm text-on-surface-variant">
          Manage your profile, notifications, and clinic preferences from one place.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription className="mt-1">
                  Keep your staff details current so records and communications stay accurate.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="staffName">Staff Name</Label>
                <Input
                  id="staffName"
                  value={profile.name}
                  onChange={(e) => updateProfileField('name', e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  value={profile.email}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="staffPosition">Position</Label>
                <Select
                  value={profile.position}
                  onValueChange={(value) => updateProfileField('position', value)}
                >
                  <SelectTrigger id="staffPosition">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clinic Staff">Clinic Staff</SelectItem>
                    <SelectItem value="Clinic Doctor">Clinic Doctor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="staffPhone">Phone Number</Label>
                <Input
                  id="staffPhone"
                  value={profile.phone}
                  onChange={(e) => updateProfileField('phone', e.target.value)}
                  placeholder="Contact number"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground sm:max-w-md">
                {hasProfileChanges
                  ? 'You have unsaved profile updates.'
                  : 'Your profile details are already up to date.'}
              </p>
              <Button
                onClick={requestSaveConfirmation}
                disabled={savingProfile || !hasProfileChanges || !isProfileValid}
                className="w-full sm:w-auto"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription className="mt-1">
                  Choose which reminders and updates should reach you.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for new submissions
                  </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={notifications.emailAlerts}
                onChange={(e) => setNotifications((prev) => ({ ...prev, emailAlerts: e.target.checked }))}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">Pending Review Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Daily reminder for pending submissions
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={notifications.pendingReminders}
                onChange={(e) => setNotifications((prev) => ({ ...prev, pendingReminders: e.target.checked }))}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">Weekly Reports</p>
                <p className="text-sm text-muted-foreground">
                  Receive weekly summary reports
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={notifications.weeklyReports}
                onChange={(e) => setNotifications((prev) => ({ ...prev, weeklyReports: e.target.checked }))}
              />
            </div>
            <Button className="w-full sm:w-auto">Save Notification Preferences</Button>
          </CardContent>
        </Card>

        <PasswordChangeCard title="Change Password" description="Update the password for your clinic staff account." />

        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>System Settings</CardTitle>
                <CardDescription className="mt-1">
                  Review the active academic term and clinic availability settings.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="academicYear">Current Academic Year</Label>
              <Input
                id="academicYear"
                value={system.academicYear}
                onChange={(e) => setSystem((prev) => ({ ...prev, academicYear: e.target.value }))}
                placeholder="e.g., 2023-2024"
              />
            </div>
            <div>
              <Label htmlFor="semester">Current Semester</Label>
              <select
                id="semester"
                className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={system.semester}
                onChange={(e) => setSystem((prev) => ({ ...prev, semester: e.target.value }))}
              >
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Summer</option>
              </select>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">
                  Disable student submissions temporarily
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={system.maintenanceMode}
                onChange={(e) => setSystem((prev) => ({ ...prev, maintenanceMode: e.target.checked }))}
              />
            </div>
            <Button className="w-full sm:w-auto">Save System Settings</Button>
          </CardContent>
        </Card>

      </div>

      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save profile changes?</DialogTitle>
            <DialogDescription>
              Are you sure you want to save your updated profile information?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setConfirmSaveOpen(false)}
              disabled={savingProfile}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleProfileSave();
              }}
              disabled={savingProfile}
              className="w-full sm:w-auto"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
