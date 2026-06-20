import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarRange,
  Clock3,
  DatabaseBackup,
  FileArchive,
  MailCheck,
  RotateCcw,
  Save,
  ScanText,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import PortalPageIntro from '../../components/portal-page-intro';
import { PortalPageSkeleton } from '../../components/project-skeletons';
import {
  createDefaultAdminSystemSettings,
  type AdminSystemSettings,
  updateAcademicYearSetting,
  updateAdminSystemSettings,
} from '../../lib/api';
import { formatAcademicYearLabel, getDefaultAcademicYear, normalizeAcademicYear } from '../../lib/academic-year';
import { academicYearQueryKey, useAcademicYear } from '../../lib/academic-year-query';
import { toast } from 'sonner';
import {
  adminSystemSettingsQueryKey,
  invalidateAdminWorkflowQueries,
  useAdminSystemSettingsQuery,
} from './admin-workflow-query';

const sessionTimeoutOptions = [15, 30, 45, 60, 120] as const;
const autoArchiveOptions = [
  { value: 0, label: 'Do not auto-archive' },
  { value: 12, label: 'After 12 months' },
  { value: 24, label: 'After 24 months' },
  { value: 36, label: 'After 36 months' },
] as const;
const UPCOMING_ACADEMIC_YEAR_OPTION_COUNT = 8;

type SettingSectionProps = {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
};

type SettingRowProps = {
  title: string;
  children: ReactNode;
};

function SettingSection({ icon: Icon, title, children }: SettingSectionProps) {
  return (
    <Card className="overflow-hidden border-outline-variant/35 bg-surface-container-lowest">
      <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/35 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-lg font-semibold text-on-surface">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-outline-variant/25 p-0">{children}</CardContent>
    </Card>
  );
}

function SettingRow({ title, children }: SettingRowProps) {
  return (
    <div className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)] sm:items-center sm:px-6">
      <div className="min-w-0">
        <p className="font-medium text-on-surface">{title}</p>
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  );
}

function formatArchiveLabel(months: number) {
  return autoArchiveOptions.find((option) => option.value === months)?.label || 'After 12 months';
}

function getAcademicYearOptionLabel(academicYear: string) {
  const [startYear, endYear] = academicYear.split('-');
  return `${startYear} - ${endYear}`;
}

function buildUpcomingAcademicYearOptions(referenceDate = new Date()) {
  const baseAcademicYear = getDefaultAcademicYear(referenceDate);
  const baseStartYear = Number.parseInt(baseAcademicYear.slice(0, 4), 10);

  return Array.from({ length: UPCOMING_ACADEMIC_YEAR_OPTION_COUNT }, (_, index) => {
    const startYear = baseStartYear + index;
    const academicYear = `${startYear}-${startYear + 1}`;

    return {
      value: academicYear,
      label: getAcademicYearOptionLabel(academicYear),
    };
  });
}

export default function AdminSystemSettings() {
  const queryClient = useQueryClient();
  const defaults = useMemo(() => createDefaultAdminSystemSettings(), []);
  const [savedSettings, setSavedSettings] = useState<AdminSystemSettings>(defaults);
  const [draftSettings, setDraftSettings] = useState<AdminSystemSettings>(defaults);
  const [academicYearInput, setAcademicYearInput] = useState(defaults.academicYear);
  const [isSaving, setIsSaving] = useState(false);
  const { data: settingsData, isLoading, isError, error } = useAdminSystemSettingsQuery();
  const {
    academicYear: activeAcademicYear,
    academicYearLabel,
    settingValue: academicYearSettingValue,
  } = useAcademicYear();
  const academicYearOptions = useMemo(() => buildUpcomingAcademicYearOptions(), []);
  const filteredAcademicYearOptions = useMemo(() => {
    if (!activeAcademicYear) return academicYearOptions;
    const currentStartYear = Number.parseInt(activeAcademicYear.slice(0, 4), 10);
    return academicYearOptions.filter((option) => {
      const optionStartYear = Number.parseInt(option.value.slice(0, 4), 10);
      return optionStartYear >= currentStartYear;
    });
  }, [academicYearOptions, activeAcademicYear]);
  const firstAcademicYearOption = filteredAcademicYearOptions[0]?.value || getDefaultAcademicYear();

  useEffect(() => {
    if (!settingsData) return;
    setSavedSettings(settingsData);
    setDraftSettings(settingsData);
  }, [settingsData]);

  useEffect(() => {
    const nextAcademicYearInput = filteredAcademicYearOptions.some((option) => option.value === activeAcademicYear)
      ? activeAcademicYear
      : firstAcademicYearOption;
    setAcademicYearInput(nextAcademicYearInput);
  }, [activeAcademicYear, filteredAcademicYearOptions, firstAcademicYearOption]);

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

  const normalizedAcademicYearInput = normalizeAcademicYear(academicYearInput, '');
  const hasAcademicYearChanges = normalizedAcademicYearInput !== activeAcademicYear;
  const selectedAcademicYearLabel = academicYearOptions.find((option) => option.value === academicYearInput)?.label
    || getAcademicYearOptionLabel(normalizedAcademicYearInput || firstAcademicYearOption);
  const academicYearMutation = useMutation({
    mutationFn: updateAcademicYearSetting,
    onSuccess: async (saved) => {
      const nextAcademicYearInput = academicYearOptions.some((option) => option.value === saved.academicYear)
        ? saved.academicYear
        : firstAcademicYearOption;
      setAcademicYearInput(nextAcademicYearInput);
      queryClient.setQueryData(academicYearQueryKey(), saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminSystemSettingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ['staffDashboardOverview'] }),
      ]);
      toast.success(`Active academic year updated to ${formatAcademicYearLabel(saved.academicYear)}.`);
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to update the active academic year.',
      );
    },
  });

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

  const handleAcademicYearSave = async () => {
    await academicYearMutation.mutateAsync(academicYearInput);
  };

  const settingsSummary = [
    {
      label: 'Active School Year',
      value: academicYearLabel,
      icon: CalendarRange,
    },
    {
      label: 'Student Intake',
      value: draftSettings.acceptingSubmissions ? 'Open' : 'Paused',
      icon: SlidersHorizontal,
    },
    {
      label: 'Admin Session',
      value: `${draftSettings.sessionTimeoutMinutes} min`,
      icon: Clock3,
    },
    {
      label: 'Record Retention',
      value: formatArchiveLabel(draftSettings.autoArchiveAfterMonths),
      icon: FileArchive,
    },
    {
      label: 'OCR Service',
      value: draftSettings.ocrProvider === 'azure' ? 'Azure' : 'OCR.space',
      icon: ScanText,
    },
    {
      label: 'OCR Usage',
      value: `${draftSettings.ocrCallsCount ?? 0} call${(draftSettings.ocrCallsCount ?? 0) === 1 ? '' : 's'}`,
      icon: ScanText,
    },
  ];

  if (isLoading) {
    return <PortalPageSkeleton variant="dashboard" />;
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <PortalPageIntro
        title="Administrative Settings"
        actions={(
          <Badge className={hasChanges ? 'bg-amber-100 px-3 py-1 text-amber-700' : 'bg-emerald-100 px-3 py-1 text-emerald-700'}>
            {hasChanges ? 'Unsaved changes' : 'Up to date'}
          </Badge>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {settingsSummary.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[18px] border border-outline-variant/35 bg-surface-container-lowest p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 truncate text-xl font-bold text-on-surface">{item.value}</p>
                </div>
                <Icon className="h-6 w-6 shrink-0 text-primary" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.85fr)] xl:items-start">
        <div className="space-y-6">
          <SettingSection
            icon={CalendarRange}
            title="Academic Term Settings"
          >
            <SettingRow title="Active academic year">
              <div className="flex flex-col gap-2 w-full sm:w-[220px]">
                <Select value={academicYearInput} onValueChange={setAcademicYearInput}>
                  <SelectTrigger
                    id="currentAcademicYear"
                    className="h-10 rounded-lg border-outline-variant/50 bg-surface-container-lowest text-sm font-semibold shadow-none"
                  >
                    <SelectValue placeholder="Select school year" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAcademicYearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasAcademicYearChanges && (
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                    disabled={academicYearMutation.isPending}
                    onClick={() => void handleAcademicYearSave()}
                  >
                    {academicYearMutation.isPending ? 'Updating...' : 'Update School Year'}
                  </Button>
                )}
              </div>
            </SettingRow>
            <SettingRow
              title="Student medical record submissions"
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
          >
        <SettingRow
          title="Student status email notifications"
        >
          <Switch
            checked={draftSettings.approvalEmailNotifications}
            onCheckedChange={(checked) => updateField('approvalEmailNotifications', checked)}
          />
        </SettingRow>
        <SettingRow
          title="Pending review reminders"
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
          >
        <SettingRow
          title="Require two-factor authentication policy"
        >
          <Switch
            checked={draftSettings.requireTwoFactorAuth}
            onCheckedChange={(checked) => updateField('requireTwoFactorAuth', checked)}
          />
        </SettingRow>
        <SettingRow
          title="Inactive session timeout"
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
          >
        <SettingRow
          title="Auto-archive graduated or inactive records"
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

          <SettingSection
            icon={ScanText}
            title="OCR Service"
          >
        <SettingRow
          title="Active OCR provider"
        >
          <Select
            value={draftSettings.ocrProvider}
            onValueChange={(value) => updateField('ocrProvider', value as 'azure' | 'ocr-space')}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Select OCR service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="azure">Azure AI Vision</SelectItem>
              <SelectItem value="ocr-space">OCR.space</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingSection>

        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <PasswordChangeCard title="Administrator Password" />

          <Card className="border-outline-variant/35 bg-surface-container-lowest">
        <CardHeader>
          <div className="flex items-center gap-3">
            <MailCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold text-on-surface">Save Administrative Settings</CardTitle>
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
      </div>
    </div>
  );
}
