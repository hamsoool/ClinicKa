import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarRange, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import PasswordChangeCard from '../../components/password-change-card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import {
  createDefaultAdminSystemSettings,
  type AdminSystemSettings,
  updateAdminSystemSettings,
} from '../../lib/api';
import { toast } from 'sonner';
import {
  adminSystemSettingsQueryKey,
  invalidateAdminWorkflowQueries,
  useAdminSystemSettingsQuery,
} from './admin-workflow-query';

const semesterOptions = ['First Semester', 'Second Semester', 'Summer'] as const;
const sessionTimeoutOptions = [15, 30, 45, 60, 120] as const;
const autoArchiveOptions = [
  { value: 0, label: 'Never automatically' },
  { value: 12, label: 'After 12 months' },
  { value: 24, label: 'After 24 months' },
  { value: 36, label: 'After 36 months' },
] as const;

export default function AdminSystemSettings() {
  const queryClient = useQueryClient();
  const defaults = useMemo(() => createDefaultAdminSystemSettings(), []);
  const [savedSettings, setSavedSettings] = useState<AdminSystemSettings>(defaults);
  const [draftSettings, setDraftSettings] = useState<AdminSystemSettings>(defaults);
  const [isSaving, setIsSaving] = useState(false);
  const { data: settingsData, isLoading, isError, error } = useAdminSystemSettingsQuery();

  useEffect(() => {
    if (!settingsData) return;
    setSavedSettings(settingsData);
    setDraftSettings(settingsData);
  }, [settingsData]);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : 'Failed to load system settings.');
    }
  }, [error, isError]);

  const hasChanges = useMemo(
    () => JSON.stringify(savedSettings) !== JSON.stringify(draftSettings),
    [draftSettings, savedSettings],
  );

  const updateField = <K extends keyof AdminSystemSettings>(
    field: K,
    value: AdminSystemSettings[K],
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await updateAdminSystemSettings(draftSettings);
      setSavedSettings(saved);
      setDraftSettings(saved);
      queryClient.setQueryData(adminSystemSettingsQueryKey(), saved);
      await invalidateAdminWorkflowQueries(queryClient, { includeSettings: true });
      toast.success('System settings saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save system settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">System Settings</h1>
        <p className="text-muted-foreground">Manage academic cycle, portal access, and clinic operations preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarRange className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Academic Configuration</CardTitle>
              <CardDescription>Control the active term and whether students can continue submitting records.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic Year</Label>
              <Input
                id="academicYear"
                value={draftSettings.academicYear}
                onChange={(event) => updateField('academicYear', event.target.value)}
                placeholder="e.g., 2025-2026"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Select
                value={draftSettings.semester}
                onValueChange={(value) => updateField('semester', value as AdminSystemSettings['semester'])}
              >
                <SelectTrigger id="semester">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Accept Student Submissions</p>
              <p className="text-sm text-muted-foreground">Turn this off when the clinic needs to pause intake or maintenance.</p>
            </div>
            <Switch
              checked={draftSettings.acceptingSubmissions}
              onCheckedChange={(checked) => updateField('acceptingSubmissions', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Security and Access</CardTitle>
              <CardDescription>Set the baseline behavior for administrator and clinic staff access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Require Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Keep elevated accounts protected with an extra sign-in step.</p>
            </div>
            <Switch
              checked={draftSettings.requireTwoFactorAuth}
              onCheckedChange={(checked) => updateField('requireTwoFactorAuth', checked)}
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Session Timeout</p>
              <p className="text-sm text-muted-foreground">Automatically sign out inactive users after the selected period.</p>
            </div>
            <Select
              value={String(draftSettings.sessionTimeoutMinutes)}
              onValueChange={(value) => updateField('sessionTimeoutMinutes', Number(value))}
            >
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Select timeout" />
              </SelectTrigger>
              <SelectContent>
                {sessionTimeoutOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Audit Logging</p>
              <p className="text-sm text-muted-foreground">Keep a record of administrator actions and access events.</p>
            </div>
            <Switch
              checked={draftSettings.auditLogging}
              onCheckedChange={(checked) => updateField('auditLogging', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <PasswordChangeCard title="Change Password" description="Update the password for your administrator account." />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Notifications and Retention</CardTitle>
              <CardDescription>Choose how the clinic gets notified and how long older records stay active.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Approval Email Notifications</p>
              <p className="text-sm text-muted-foreground">Send alerts when submissions are approved or sent back for revision.</p>
            </div>
            <Switch
              checked={draftSettings.approvalEmailNotifications}
              onCheckedChange={(checked) => updateField('approvalEmailNotifications', checked)}
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Pending Review Reminders</p>
              <p className="text-sm text-muted-foreground">Keep the clinic team aware of submissions that still need attention.</p>
            </div>
            <Switch
              checked={draftSettings.pendingReviewReminders}
              onCheckedChange={(checked) => updateField('pendingReviewReminders', checked)}
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Auto-Archive Graduated Records</p>
              <p className="text-sm text-muted-foreground">Move older records out of the active workspace after the selected period.</p>
            </div>
            <Select
              value={String(draftSettings.autoArchiveAfterMonths)}
              onValueChange={(value) => updateField('autoArchiveAfterMonths', Number(value))}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select archive timing" />
              </SelectTrigger>
              <SelectContent>
                {autoArchiveOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Save Changes</CardTitle>
              <CardDescription>
                {hasChanges
                  ? 'You have unsaved system settings changes.'
                  : 'System settings are up to date.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            disabled={isSaving || !hasChanges}
            onClick={() => setDraftSettings(savedSettings)}
          >
            Reset Changes
          </Button>
          <Button disabled={isSaving || !hasChanges} onClick={() => void handleSave()}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        These settings are used to manage the academic term, portal access rules, and clinic-side admin preferences.
      </div>
    </div>
  );
}
