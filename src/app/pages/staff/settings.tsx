import { useEffect, useMemo, useState } from 'react';
import { Award, Check, ClipboardCheck, PenLine, User } from 'lucide-react';
import PortalPageIntro from '../../components/portal-page-intro';
import { toast } from 'sonner';
import FilePickerButton from '../../components/file-picker-button';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import {
  getRoleLabel,
  getStaffSignature,
  updateStaffProfile,
  uploadStaffSignature,
  type StaffSignatureAsset,
} from '../../lib/api';
import { formatPhilippinePhoneInput, isValidPhilippinePhoneNumber } from '../student/medical-form/constants';
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

const STAFF_SIGNATURE_ACCEPT_ATTRIBUTE = 'image/*,.png,.jpg,.jpeg,.heic,.heif,.webp';
const STAFF_SIGNATURE_ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'heic', 'heif', 'webp']);

function normalizeProfileValue(value: string) {
  return value.trim();
}

function getFileExtension(file?: File | null) {
  const fileName = String(file?.name || '');
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
}

function isAllowedSignatureImage(file?: File | null) {
  if (!file) return false;
  const mimeType = String(file.type || '').toLowerCase();
  return mimeType.startsWith('image/') || STAFF_SIGNATURE_ALLOWED_EXTENSIONS.has(getFileExtension(file));
}

function buildEmptyStaffSignature(): StaffSignatureAsset {
  return {
    signatureUrl: null,
    signatureFileName: null,
  };
}

function withCacheBust(url: string | null | undefined) {
  const value = String(url || '').trim();
  if (!value) return null;
  const separator = value.includes('?') ? '&' : '?';
  return `${value}${separator}t=${Date.now()}`;
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
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [staffSignature, setStaffSignature] = useState<StaffSignatureAsset>(buildEmptyStaffSignature);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [savedWorkspacePreferences, setSavedWorkspacePreferences] =
    useState<StaffWorkspacePreferences>(initialWorkspacePreferences);
  const [workspacePreferences, setWorkspacePreferences] =
    useState<StaffWorkspacePreferences>(initialWorkspacePreferences);
  const [savingWorkspacePreferences, setSavingWorkspacePreferences] = useState(false);

  useEffect(() => {
    setProfile(initialProfileData);
  }, [initialProfileData]);

  useEffect(() => {
    if (!me?.profile?.id) {
      setStaffSignature(buildEmptyStaffSignature());
      setLoadingSignature(false);
      return;
    }

    let active = true;
    setLoadingSignature(true);

    const loadSignature = async () => {
      try {
        const signature = await getStaffSignature();
        if (active) {
          setStaffSignature(signature);
        }
      } catch {
        if (active) {
          setStaffSignature(buildEmptyStaffSignature());
        }
      } finally {
        if (active) {
          setLoadingSignature(false);
        }
      }
    };

    void loadSignature();

    return () => {
      active = false;
    };
  }, [me?.profile?.id]);

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(signatureFile);
    setSignaturePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [signatureFile]);

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
    Boolean(profile.name.trim()) &&
    Boolean(profile.email.trim()) &&
    (!profile.phone.trim() || isValidPhilippinePhoneNumber(profile.phone));
  const currentStaffSignatureUrl = signaturePreviewUrl || staffSignature.signatureUrl || null;

  const updateProfileField = <K extends keyof StaffProfileFormState>(field: K, value: StaffProfileFormState[K]) => {
    setProfile((prev) => ({
      ...prev,
      [field]: field === 'phone' ? formatPhilippinePhoneInput(String(value)) as StaffProfileFormState[K] : value,
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
      toast.error('Please complete your name and email, and use a valid phone number if provided.');
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

  const handleSignatureChange = (file: File | null) => {
    if (!file) {
      setSignatureFile(null);
      return;
    }

    if (!isAllowedSignatureImage(file)) {
      toast.error('Please upload an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Staff signature must be 5 MB or smaller.');
      return;
    }

    setSignatureFile(file);
  };

  const handleSignatureUpload = async () => {
    if (!signatureFile) {
      toast.info('Choose a signature image first.');
      return;
    }

    setUploadingSignature(true);
    try {
      const uploaded = await uploadStaffSignature(signatureFile);
      const refreshed = await getStaffSignature().catch(() => buildEmptyStaffSignature());
      setStaffSignature({
        signatureUrl: withCacheBust(uploaded.signatureUrl || refreshed.signatureUrl),
        signatureFileName: signatureFile.name || refreshed.signatureFileName || uploaded.signatureFileName || null,
      });
      setSignatureFile(null);
      toast.success('Staff signature uploaded successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload staff signature.');
    } finally {
      setUploadingSignature(false);
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
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <PortalPageIntro
        title="Settings"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.85fr)] xl:items-start">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Profile Settings</CardTitle>
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
                <Label htmlFor="staffPosition">Role</Label>
                <Input
                  id="staffPosition"
                  value={staffRoleLabel}
                  readOnly
                  disabled
                  className="cursor-not-allowed opacity-80"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="staffPhone">Phone Number</Label>
                <Input
                  id="staffPhone"
                  value={profile.phone}
                  onChange={(event) => updateProfileField('phone', event.target.value)}
                  inputMode="numeric"
                  placeholder="(+63) 9123456789"
                />
                {profile.phone.trim() && !isValidPhilippinePhoneNumber(profile.phone) ? (
                  <p className="mt-2 text-xs text-red-600">Use the format (+63) 9123456789.</p>
                ) : null}
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

        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <PenLine className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Staff Signature</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilePickerButton
                accept={STAFF_SIGNATURE_ACCEPT_ATTRIBUTE}
                ariaLabel="Choose staff signature image"
                disabled={uploadingSignature}
                onFileSelected={handleSignatureChange}
                className="w-full gap-2"
              >
                <PenLine className="mr-2 h-4 w-4" />
                Choose Signature
              </FilePickerButton>

              <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border bg-white px-4">
                  {currentStaffSignatureUrl ? (
                    <img
                      src={currentStaffSignatureUrl}
                      alt="Staff signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {loadingSignature ? 'Loading signature...' : 'No saved signature'}
                    </span>
                  )}
                </div>
                <div className="min-w-0 text-sm">
                  {signatureFile ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="h-4 w-4" />
                      <span className="block min-w-0 truncate" title={signatureFile.name}>
                        {signatureFile.name}
                      </span>
                    </div>
                  ) : staffSignature.signatureFileName ? (
                    <p className="truncate text-on-surface-variant" title={staffSignature.signatureFileName}>
                      {staffSignature.signatureFileName}
                    </p>
                  ) : (
                    <p className="text-on-surface-variant">No saved signature</p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={() => {
                  void handleSignatureUpload();
                }}
                disabled={uploadingSignature || !signatureFile}
                className="w-full"
              >
                {uploadingSignature ? 'Uploading...' : 'Save Signature'}
              </Button>
            </CardContent>
          </Card>

          <PasswordChangeCard title="Change Password" />

          <SettingsLogoutCard className="flex justify-end" />
        </div>
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
