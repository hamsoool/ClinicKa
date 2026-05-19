import { useEffect, useMemo, useState } from 'react';
import { Award, ClipboardCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../lib/auth';
import { getRoleLabel, updateStaffProfile } from '../../lib/api';
import {
  loadStaffWorkspacePreferences,
  saveStaffWorkspacePreferences,
  type StaffWorkspacePreferences,
} from './staff-workspace-preferences';

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
  const staffRoleLabel = useMemo(
    () => getRoleLabel(me?.profile?.role, me?.staff?.position),
    [me?.profile?.role, me?.staff?.position],
  );
  const staffPreferenceId = String(me?.staff?.id || me?.profile.email || '').trim();
  const initialWorkspacePreferences = useMemo(
    () => loadStaffWorkspacePreferences(staffPreferenceId, staffRoleLabel),
    [staffPreferenceId, staffRoleLabel],
  );

  const [profile, setProfile] = useState<StaffProfileFormState>(initialProfileData);
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [savedWorkspacePreferences, setSavedWorkspacePreferences] =
    useState<StaffWorkspacePreferences>(initialWorkspacePreferences);
  const [workspacePreferences, setWorkspacePreferences] =
    useState<StaffWorkspacePreferences>(initialWorkspacePreferences);
  const [savingWorkspacePreferences, setSavingWorkspacePreferences] = useState(false);

  useEffect(() => {
    setProfile(initialProfileData);
  }, [initialProfileData]);

  useEffect(() => {
    setSavedWorkspacePreferences(initialWorkspacePreferences);
    setWorkspacePreferences(initialWorkspacePreferences);
  }, [initialWorkspacePreferences]);

  const hasProfileChanges = useMemo(
    () =>
      (Object.keys(initialProfileData) as Array<keyof StaffProfileFormState>).some(
        (key) => normalizeProfileValue(profile[key]) !== normalizeProfileValue(initialProfileData[key]),
      ),
    [initialProfileData, profile],
  );
  const hasWorkspacePreferenceChanges = useMemo(
    () => JSON.stringify(workspacePreferences) !== JSON.stringify(savedWorkspacePreferences),
    [savedWorkspacePreferences, workspacePreferences],
  );

  const isProfileValid =
    Boolean(profile.name.trim()) && Boolean(profile.email.trim()) && Boolean(profile.position.trim());
  const isDoctorWorkspace = profile.position === 'Clinic Doctor' || staffRoleLabel === 'Clinic Doctor';

  const updateProfileField = <K extends keyof StaffProfileFormState>(field: K, value: StaffProfileFormState[K]) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateWorkspacePreference = <K extends keyof StaffWorkspacePreferences>(
    field: K,
    value: StaffWorkspacePreferences[K],
  ) => {
    setWorkspacePreferences((prev) => ({
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

  const handleWorkspacePreferenceSave = () => {
    if (!staffPreferenceId) {
      toast.error('Unable to save workspace settings for this account right now.');
      return;
    }

    setSavingWorkspacePreferences(true);
    try {
      const saved = saveStaffWorkspacePreferences(staffPreferenceId, workspacePreferences, profile.position || staffRoleLabel);
      setSavedWorkspacePreferences(saved);
      setWorkspacePreferences(saved);
      toast.success('Workspace settings updated successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save workspace settings.');
    } finally {
      setSavingWorkspacePreferences(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-on-surface">Settings</h1>
        <p className="max-w-2xl text-sm text-on-surface-variant">
          Manage your profile, review workflow, certificate workspace, and account security from one place.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
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
                  onChange={(event) => updateProfileField('name', event.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  value={profile.email}
                  onChange={(event) => updateProfileField('email', event.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="staffPosition">Position</Label>
                <Select value={profile.position} onValueChange={(value) => updateProfileField('position', value)}>
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
                  onChange={(event) => updateProfileField('phone', event.target.value)}
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
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Review Workspace</CardTitle>
                <CardDescription className="mt-1">
                  Choose how your dashboard and review queue open when you start clinic work.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="dashboardQueueTab">Dashboard default queue tab</Label>
                <Select
                  value={workspacePreferences.dashboardQueueTab}
                  onValueChange={(value) => updateWorkspacePreference('dashboardQueueTab', value as StaffWorkspacePreferences['dashboardQueueTab'])}
                >
                  <SelectTrigger id="dashboardQueueTab">
                    <SelectValue placeholder="Choose a starting tab" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="in_review">In review</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="resubmitted">Resubmitted</SelectItem>
                    <SelectItem value="all">All action items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="reviewQueueStatus">Review queue default filter</Label>
                <Select
                  value={workspacePreferences.reviewQueueStatus}
                  onValueChange={(value) => updateWorkspacePreference('reviewQueueStatus', value as StaffWorkspacePreferences['reviewQueueStatus'])}
                >
                  <SelectTrigger id="reviewQueueStatus">
                    <SelectValue placeholder="Choose a default filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action_needed">Needs action</SelectItem>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="in_review">In review</SelectItem>
                    <SelectItem value="physical_exam_done">Physical exam done</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="resubmitted">Resubmitted</SelectItem>
                    <SelectItem value="all">All records</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="reviewSortOrder">Review queue sort order</Label>
                <Select
                  value={workspacePreferences.reviewSortOrder}
                  onValueChange={(value) => updateWorkspacePreference('reviewSortOrder', value as StaffWorkspacePreferences['reviewSortOrder'])}
                >
                  <SelectTrigger id="reviewSortOrder">
                    <SelectValue placeholder="Choose a sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest first</SelectItem>
                    <SelectItem value="asc">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-on-surface">Show advanced filters on open</p>
                    <p className="text-sm text-muted-foreground">
                      Open the full filter row immediately in the review queue.
                    </p>
                  </div>
                  <Switch
                    checked={workspacePreferences.showAdvancedQueueFilters}
                    onCheckedChange={(checked) => updateWorkspacePreference('showAdvancedQueueFilters', checked)}
                    aria-label="Show advanced filters on open"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Certificate Workspace</CardTitle>
                <CardDescription className="mt-1">
                  Set how {isDoctorWorkspace ? 'clearances and active charts' : 'records and clearance previews'} should open in the certificates area.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="certificatesDefaultView">Default certificate view</Label>
                <Select
                  value={workspacePreferences.certificatesDefaultView}
                  onValueChange={(value) =>
                    updateWorkspacePreference('certificatesDefaultView', value as StaffWorkspacePreferences['certificatesDefaultView'])
                  }
                >
                  <SelectTrigger id="certificatesDefaultView">
                    <SelectValue placeholder="Choose a default view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form">Medical record form</SelectItem>
                    <SelectItem value="medical-clearance">Medical clearance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-on-surface">Remember last selected student</p>
                    <p className="text-sm text-muted-foreground">
                      Return to the last certificate student you were working on.
                    </p>
                  </div>
                  <Switch
                    checked={workspacePreferences.rememberLastCertificateStudent}
                    onCheckedChange={(checked) => updateWorkspacePreference('rememberLastCertificateStudent', checked)}
                    aria-label="Remember last selected student"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground sm:max-w-xl">
                {hasWorkspacePreferenceChanges
                  ? 'You have unsaved workspace preference changes.'
                  : 'Your workflow settings are already up to date.'}
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWorkspacePreferences(savedWorkspacePreferences)}
                  disabled={savingWorkspacePreferences || !hasWorkspacePreferenceChanges}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={handleWorkspacePreferenceSave}
                  disabled={savingWorkspacePreferences || !hasWorkspacePreferenceChanges}
                  className="w-full sm:w-auto"
                >
                  {savingWorkspacePreferences ? 'Saving...' : 'Save Workspace Settings'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div id="password">
          <PasswordChangeCard title="Change Password" description="Update the password for your clinic staff account." />
        </div>

        <SettingsLogoutCard className="flex justify-end" />
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
