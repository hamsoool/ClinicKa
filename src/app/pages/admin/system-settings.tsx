import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarRange,
  Clock3,
  DatabaseBackup,
  FileArchive,
  MailCheck,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
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
  { value: 0, label: 'Do not auto-archive' },
  { value: 12, label: 'After 12 months' },
  { value: 24, label: 'After 24 months' },
  { value: 36, label: 'After 36 months' },
] as const;

type SettingSectionProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
};

type SettingRowProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function SettingSection({ icon: Icon, title, description, children }: SettingSectionProps) {
  return (
    <Card className="overflow-hidden border-outline-variant/35 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
      <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/35 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-lg font-semibold text-on-surface">{title}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-6">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-outline-variant/25 p-0">{children}</CardContent>
    </Card>
  );
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)] sm:items-center sm:px-6">
      <div className="min-w-0">
        <p className="font-medium text-on-surface">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  );
}

function formatArchiveLabel(months: number) {
  return autoArchiveOptions.find((option) => option.value === months)?.label || 'After 12 months';
}

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
      toast.success('Administrative settings saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save administrative settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const settingsSummary = [
    {
      label: 'Academic Term',
      value: draftSettings.academicYear,
      detail: draftSettings.semester,
      icon: CalendarRange,
    },
    {
      label: 'Student Intake',
      value: draftSettings.acceptingSubmissions ? 'Open' : 'Paused',
      detail: draftSettings.acceptingSubmissions ? 'Students can submit records' : 'New submissions are paused',
      icon: SlidersHorizontal,
    },
    {
      label: 'Admin Session',
      value: `${draftSettings.sessionTimeoutMinutes} min`,
      detail: 'Automatic inactivity timeout',
      icon: Clock3,
    },
    {
      label: 'Record Retention',
      value: formatArchiveLabel(draftSettings.autoArchiveAfterMonths),
      detail: 'Graduated or inactive records',
      icon: FileArchive,
    },
  ] as const;

  if (isLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">Administrative Settings</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            Configure the school year, clinic intake, review notifications, account safeguards, and record retention policies for ClinicKa.
          </p>
        </div>
        <Badge className={hasChanges ? 'bg-amber-100 px-3 py-1 text-amber-700' : 'bg-emerald-100 px-3 py-1 text-emerald-700'}>
          {hasChanges ? 'Unsaved changes' : 'Up to date'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {settingsSummary.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-5 shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 truncate text-xl font-bold text-on-surface">{item.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Icon className="h-6 w-6 shrink-0 text-primary" />
              </div>
            </div>
          );
        })}
      </div>

      <SettingSection
        icon={CalendarRange}
        title="Academic Term and Student Intake"
        description="Set the active school term and control whether students can submit medical records."
      >
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="academicYear">Academic Year</Label>
            <Input
              id="academicYear"
              value={draftSettings.academicYear}
              onChange={(event) => updateField('academicYear', event.target.value)}
              placeholder="e.g., 2025-2026"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Use the format YYYY-YYYY.</p>
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
        <SettingRow
          title="Student medical record submissions"
          description="Pause this during clinic maintenance, records cutoff, or term transition periods."
        >
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Badge className={draftSettings.acceptingSubmissions ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
              {draftSettings.acceptingSubmissions ? 'Open' : 'Paused'}
            </Badge>
            <Switch
              checked={draftSettings.acceptingSubmissions}
              onCheckedChange={(checked) => updateField('acceptingSubmissions', checked)}
            />
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection
        icon={Bell}
        title="Clinic Review Communication"
        description="Control how students and clinic staff are notified as medical records move through review."
      >
        <SettingRow
          title="Student status email notifications"
          description="Send email updates when records are approved, returned for correction, or marked for final review."
        >
          <Switch
            checked={draftSettings.approvalEmailNotifications}
            onCheckedChange={(checked) => updateField('approvalEmailNotifications', checked)}
          />
        </SettingRow>
        <SettingRow
          title="Pending review reminders"
          description="Keep pending submissions visible as records wait for clinic staff action."
        >
          <Switch
            checked={draftSettings.pendingReviewReminders}
            onCheckedChange={(checked) => updateField('pendingReviewReminders', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        icon={ShieldCheck}
        title="Account Access and Admin Safeguards"
        description="Set access policies for administrators and clinic personnel who handle student health records."
      >
        <SettingRow
          title="Require two-factor authentication policy"
          description="Mark elevated accounts as requiring an extra sign-in verification step when available."
        >
          <Switch
            checked={draftSettings.requireTwoFactorAuth}
            onCheckedChange={(checked) => updateField('requireTwoFactorAuth', checked)}
          />
        </SettingRow>
        <SettingRow
          title="Inactive session timeout"
          description="Automatically sign out idle admin and clinic staff sessions after the selected period."
        >
          <Select
            value={String(draftSettings.sessionTimeoutMinutes)}
            onValueChange={(value) => updateField('sessionTimeoutMinutes', Number(value))}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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
        </SettingRow>
        <SettingRow
          title="Admin activity trail"
          description="Keep the audit policy enabled for account, archive, and settings changes."
        >
          <Switch
            checked={draftSettings.auditLogging}
            onCheckedChange={(checked) => updateField('auditLogging', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        icon={DatabaseBackup}
        title="Records Retention"
        description="Choose how long older student health records remain in the active administrative workspace."
      >
        <SettingRow
          title="Auto-archive graduated or inactive records"
          description="Move older records out of active work views while preserving them for administrative review."
        >
          <Select
            value={String(draftSettings.autoArchiveAfterMonths)}
            onValueChange={(value) => updateField('autoArchiveAfterMonths', Number(value))}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
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
        </SettingRow>
      </SettingSection>

      <PasswordChangeCard title="Administrator Password" description="Update the password for your administrator account." />

      <Card className="border-outline-variant/35 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <MailCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold text-on-surface">Save Administrative Settings</CardTitle>
              <CardDescription>
                {hasChanges
                  ? 'Review and save your policy changes before leaving this page.'
                  : 'The saved administrative policies match the current form.'}
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
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Changes
          </Button>
          <Button disabled={isSaving || !hasChanges} onClick={() => void handleSave()}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <SettingsLogoutCard className="flex justify-end" />
    </div>
  );
}
