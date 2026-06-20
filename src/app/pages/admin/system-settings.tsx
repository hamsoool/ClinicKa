import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CalendarRange,
  MailCheck,
  RotateCcw,
  Save,
  ScanText,
  ShieldAlert,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  createDefaultAdminSystemSettings,
  type AdminSystemSettings,
  updateAdminSystemSettings,
  sendSettingsChangeOtp,
} from '../../lib/api';
import { formatAcademicYearLabel, getDefaultAcademicYear, normalizeAcademicYear } from '../../lib/academic-year';
import { academicYearQueryKey, useAcademicYear } from '../../lib/academic-year-query';
import { toast } from 'sonner';
import {
  adminSystemSettingsQueryKey,
  invalidateAdminWorkflowQueries,
  useAdminSystemSettingsQuery,
} from './admin-workflow-query';


const autoArchiveOptions = [
  { value: 0, label: 'Do not auto-archive' },
  { value: 14, label: 'After 14 months' },
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
    <div className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
      <div className="min-w-0">
        <p className="font-medium text-on-surface">{title}</p>
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  );
}

function formatArchiveLabel(months: number) {
  return autoArchiveOptions.find((option) => option.value === months)?.label || 'After 14 months';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [warningOpen, setWarningOpen] = useState(() => location.hash !== '#password');
  const queryClient = useQueryClient();
  const defaults = useMemo(() => createDefaultAdminSystemSettings(), []);
  const [savedSettings, setSavedSettings] = useState<AdminSystemSettings>(defaults);
  const [draftSettings, setDraftSettings] = useState<AdminSystemSettings>(defaults);
  const [isSaving, setIsSaving] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
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

  const sendOtp = async () => {
    setIsSendingOtp(true);
    setOtpModalOpen(true);
    try {
      await sendSettingsChangeOtp();
      toast.success('Verification code sent to your email.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send verification code.');
      setOtpModalOpen(false);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSave = async (otp: string) => {
    setIsSaving(true);
    const academicYearChanged = draftSettings.academicYear !== savedSettings.academicYear;
    try {
      const saved = await updateAdminSystemSettings(draftSettings, otp);
      setSavedSettings(saved);
      setDraftSettings(saved);
      queryClient.setQueryData(adminSystemSettingsQueryKey(), saved);
      
      const promises = [
        invalidateAdminWorkflowQueries(queryClient, { includeSettings: true })
      ];
      
      if (academicYearChanged) {
        promises.push(queryClient.invalidateQueries({ queryKey: academicYearQueryKey() }));
        promises.push(queryClient.invalidateQueries({ queryKey: ['staffDashboardOverview'] }));
      }
      
      await Promise.all(promises);
      toast.success('Administrative settings saved.');
      setOtpInput('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save administrative settings.');
    } finally {
      setIsSaving(false);
    }
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
      label: 'Account Retention',
      value: formatArchiveLabel(draftSettings.autoArchiveAfterMonths),
      icon: Archive,
    },
    {
      label: 'OCR Service',
      value: draftSettings.ocrProvider === 'azure' ? 'Azure' : 'OCR.space',
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

      {!warningOpen && (
        <div className="flex items-center gap-3 rounded-[18px] border border-rose-500/20 bg-rose-50/50 p-4 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200">
          <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Danger Zone Active:</span> You are editing settings that affect the entire ClinicKa application and all users. Please review your changes carefully before saving.
          </div>
        </div>
      )}

      <div className="grid gap-2 grid-cols-4 sm:gap-4">
        {settingsSummary.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[12px] sm:rounded-[18px] border border-outline-variant/35 bg-surface-container-lowest p-2 sm:p-5"
            >
              <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-1 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{item.label}</p>
                  <p className="mt-0.5 sm:mt-2 truncate text-[11px] sm:text-xl font-bold text-on-surface">{item.value}</p>
                </div>
                <Icon className="h-4 w-4 sm:h-6 sm:w-6 shrink-0 text-primary" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-6">
        <SettingSection
          icon={CalendarRange}
          title="Academic Term Settings"
        >
          <SettingRow title="Active academic year">
            <div className="flex flex-col gap-2 w-full sm:w-[150px]">
              <Select
                value={draftSettings.academicYear}
                onValueChange={(value) => updateField('academicYear', value)}
              >
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
          icon={Archive}
          title="Account Retention"
        >
          <SettingRow
            title="Auto-archive graduated or inactive accounts"
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
            <Button disabled={isSaving || !hasChanges} onClick={() => void sendOtp()}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>

        <SettingsLogoutCard className="flex justify-end" />
      </div>

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent className="border-rose-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5 text-rose-500 animate-bounce" />
              Caution: Danger Zone
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant mt-2 leading-relaxed">
              You are entering the <strong>Danger Zone</strong> for System Settings. Modifying these configurations will immediately affect the entire ClinicKa application, including student intake status, active academic years, admin safeguards, and database retention policies. Please proceed only if you are authorized to make these global changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel
              onClick={() => navigate('/admin')}
              className="border-outline-variant/50 hover:bg-surface-container-low"
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setWarningOpen(false)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              I Understand & Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              Security Verification
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant leading-relaxed">
              To modify these critical system configurations, you must verify your identity. We have sent a 6-digit verification code to your email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="settingsOtpInput" className="text-sm font-semibold">Verification Code</Label>
            <input
              id="settingsOtpInput"
              type="text"
              pattern="\d*"
              maxLength={6}
              placeholder="••••••"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
              className="h-12 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-4 text-center text-xl font-bold tracking-[0.3em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={isSendingOtp}
                onClick={() => void sendOtp()}
                className="text-xs text-primary font-semibold hover:bg-surface-container-low"
              >
                {isSendingOtp ? 'Sending code...' : 'Resend Code'}
              </Button>
            </div>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => {
              setOtpModalOpen(false);
              setOtpInput('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={otpInput.length !== 6 || isSendingOtp}
              onClick={() => {
                setOtpModalOpen(false);
                setConfirmModalOpen(true);
              }}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Verify Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <AlertDialogContent className="border-rose-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5 text-rose-500 animate-bounce" />
              Confirm Settings Update
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant leading-relaxed">
              Are you sure you want to proceed and save these modifications? Applying these settings will immediately affect the entire application, student workflows, and account retention databases.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel onClick={() => {
              setConfirmModalOpen(false);
              setOtpInput('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleSave(otpInput)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Yes, Apply Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
