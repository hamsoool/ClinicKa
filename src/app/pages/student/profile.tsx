import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ImageIcon, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import FilePickerButton from '../../components/file-picker-button';
import StudentPageIntro from '../../components/student-page-intro';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';
import { StudentProfileFormCard } from '../../components/student-profile-form-card';
import {
  getStudentProfileAssets,
  updateStudentProfile,
  uploadStudentProfileAsset,
  type AuthMe,
  type StudentProfileAssets,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  formatPhilippinePhoneInput,
  isValidPhilippinePhoneNumber,
  normalizeProgramForDepartment,
  resolveDepartmentValue,
} from './medical-form/constants';
import { studentProfileAssetsQueryKey } from './student-profile-assets-query';

type StudentProfileFormState = {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  department: string;
  course: string;
  yearLevel: string;
  age: string;
  sex: string;
  birthday: string;
  civilStatus: string;
  contactNumber: string;
  address: string;
};

const MAX_NAME_LENGTH = 30;
const MIN_PROFILE_AGE = 16;
const PROFILE_ASSET_ACCEPT_ATTRIBUTE = 'image/*,.png,.jpg,.jpeg,.heic,.heif';
const PROFILE_ASSET_ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'heic', 'heif', 'webp']);

function sanitizeName(value: string) {
  return String(value).normalize('NFC').replace(/[^\p{L}\s'-]/gu, '').slice(0, MAX_NAME_LENGTH);
}

function sanitizeAddress(value: string) {
  return String(value)
    .replace(/[<>`]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .slice(0, 180);
}

function getFileExtension(file?: File | null) {
  const fileName = String(file?.name || '');
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
}

function isAllowedProfileImage(file?: File | null) {
  if (!file) return false;
  const mimeType = String(file.type || '').toLowerCase();
  return mimeType.startsWith('image/') || PROFILE_ASSET_ALLOWED_EXTENSIONS.has(getFileExtension(file));
}

function parseDateInputValue(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || '').trim());
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
function calculateAgeFromBirthdate(dateValue: string) {
  const birthdate = parseDateInputValue(dateValue);
  if (!birthdate) return null;

  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDelta = today.getMonth() - birthdate.getMonth();
  const hasBirthdayPassed =
    monthDelta > 0 || (monthDelta === 0 && today.getDate() >= birthdate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function isAtLeastAge(dateValue: string, minAge: number) {
  const age = calculateAgeFromBirthdate(dateValue);
  return age !== null && age >= minAge;
}

function buildProfileFormState(me?: Pick<AuthMe, 'profile' | 'student'> | null): StudentProfileFormState {
  const department = resolveDepartmentValue(me?.student?.department || me?.profile.department || '');
  const birthday = me?.student?.birthday || '';
  const derivedAge = calculateAgeFromBirthdate(birthday);
  return {
    studentId: me?.student?.student_id || me?.profile.student_id || '',
    firstName: sanitizeName(me?.student?.first_name || me?.profile.first_name || ''),
    lastName: sanitizeName(me?.student?.last_name || me?.profile.last_name || ''),
    middleInitial: String(me?.student?.middle_initial || '').replace(/[^A-Za-z]/g, '').slice(0, 1),
    department,
    course: normalizeProgramForDepartment(department, me?.student?.course || me?.profile.course || ''),
    yearLevel: me?.student?.year_level ? String(me.student.year_level) : '',
    age: derivedAge !== null ? String(derivedAge) : (me?.student?.age ? String(me.student.age) : ''),
    sex: me?.student?.sex || 'female',
    birthday,
    civilStatus: me?.student?.civil_status || 'Single',
    contactNumber: formatPhilippinePhoneInput(me?.student?.contact_number || ''),
    address: sanitizeAddress(me?.student?.address || ''),
  };
}

function normalizeFormValue(value: string) {
  return value.trim();
}

function buildEmptyAssets(): StudentProfileAssets {
  return {
    photoUrl: null,
    signatureUrl: null,
    photoFileName: null,
    signatureFileName: null,
  };
}

function withCacheBust(url: string | null | undefined) {
  const value = String(url || '').trim();
  if (!value) return null;
  const separator = value.includes('?') ? '&' : '?';
  return `${value}${separator}t=${Date.now()}`;
}

export default function StudentProfile() {
  const { me, refresh } = useAuth();
  const queryClient = useQueryClient();
  const initialFormData = useMemo(() => buildProfileFormState(me), [me]);
  const [formData, setFormData] = useState<StudentProfileFormState>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [profileAssets, setProfileAssets] = useState<StudentProfileAssets>(buildEmptyAssets);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  useEffect(() => {
    const studentId = me?.student?.student_id || me?.profile.student_id || '';
    const profileId = me?.student?.profile_id || me?.profile.id || '';

    if (!studentId || !profileId) {
      setProfileAssets(buildEmptyAssets());
      setLoadingAssets(false);
      return;
    }

    let active = true;
    setLoadingAssets(true);

    const loadAssets = async () => {
      try {
        const assets = await getStudentProfileAssets(studentId, profileId);
        if (active) {
          setProfileAssets(assets);
        }
      } catch {
        if (active) {
          setProfileAssets(buildEmptyAssets());
        }
      } finally {
        if (active) {
          setLoadingAssets(false);
        }
      }
    };

    void loadAssets();

    return () => {
      active = false;
    };
  }, [me?.profile.id, me?.profile.student_id, me?.student?.profile_id, me?.student?.student_id]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(signatureFile);
    setSignaturePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [signatureFile]);

  const hasTextChanges = useMemo(
    () =>
      (Object.keys(initialFormData) as Array<keyof StudentProfileFormState>).some(
        (key) => normalizeFormValue(formData[key]) !== normalizeFormValue(initialFormData[key]),
      ),
    [formData, initialFormData],
  );

  const hasFileChanges = Boolean(photoFile || signatureFile);
  const hasChanges = hasTextChanges || hasFileChanges;
  const isUploadingAssets = saving && hasFileChanges;
  const hasValidContactNumber =
    !formData.contactNumber.trim() || isValidPhilippinePhoneNumber(formData.contactNumber);
  const hasValidBirthday =
    !formData.birthday.trim() || isAtLeastAge(formData.birthday, MIN_PROFILE_AGE);

  const isValid =
    Boolean(formData.studentId.trim()) &&
    Boolean(formData.firstName.trim()) &&
    Boolean(formData.lastName.trim()) &&
    Boolean(formData.middleInitial.trim()) &&
    Boolean(formData.department.trim()) &&
    Boolean(formData.course.trim()) &&
    Boolean(formData.yearLevel.trim()) &&
    Boolean(formData.age.trim()) &&
    Boolean(formData.sex.trim()) &&
    Boolean(formData.birthday.trim()) &&
    Boolean(formData.civilStatus.trim()) &&
    hasValidBirthday &&
    hasValidContactNumber;

  const currentPhotoUrl = photoPreviewUrl || profileAssets.photoUrl || null;
  const currentSignatureUrl = signaturePreviewUrl || profileAssets.signatureUrl || null;

  const updateField = <K extends keyof StudentProfileFormState>(field: K, value: StudentProfileFormState[K]) => {
    setFormData((prev) => ({
      ...prev,
      ...(field === 'department'
        ? {
            department: resolveDepartmentValue(String(value)),
            course: '',
          }
        : field === 'course'
        ? {
            course: normalizeProgramForDepartment(prev.department, String(value)),
          }
        : field === 'contactNumber'
        ? {
            contactNumber: formatPhilippinePhoneInput(String(value)),
          }
        : field === 'firstName'
        ? {
            firstName: sanitizeName(String(value)),
          }
        : field === 'lastName'
        ? {
            lastName: sanitizeName(String(value)),
          }
        : field === 'middleInitial'
        ? {
            middleInitial: String(value).replace(/[^A-Za-z]/g, '').slice(0, 1),
          }
        : field === 'age'
        ? {
            age: String(value).replace(/\D/g, '').slice(0, 2),
          }
        : field === 'birthday'
        ? {
            birthday: String(value),
            age: (() => {
              const derivedAge = calculateAgeFromBirthdate(String(value));
              return derivedAge !== null ? String(derivedAge) : '';
            })(),
          }
        : field === 'address'
        ? {
            address: sanitizeAddress(String(value)),
          }
        : {
            [field]: value,
          }),
    }));
  };

  const handleAssetChange = (type: 'photo' | 'signature', file: File | null) => {
    if (!file) {
      if (type === 'photo') setPhotoFile(null);
      else setSignatureFile(null);
      return;
    }

    if (!isAllowedProfileImage(file)) {
      toast.error('Please upload an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo and signature must be 5 MB or smaller.');
      return;
    }

    if (type === 'photo') {
      setPhotoFile(file);
    } else {
      setSignatureFile(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValid) {
      if (!hasValidContactNumber) {
        toast.error('Use a Philippine mobile number in the format (+63) 9123456789.');
        return;
      }
      if (!hasValidBirthday) {
        toast.error('Birthday must be valid and for a student who is 16 years old or above.');
        return;
      }
      toast.error('Please complete the required profile fields before saving.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateStudentProfile(formData);
      const nextStateFromResult = buildProfileFormState({
        profile: result.profile,
        student: result.student,
      });
      const resolvedStudentId = result.student?.student_id || nextStateFromResult.studentId;
      const resolvedProfileId = result.student?.profile_id || me?.student?.profile_id || result.profile.id;

      let uploadedPhotoUrl: string | null = null;
      let uploadedSignatureUrl: string | null = null;

      if (photoFile) {
        const uploaded = await uploadStudentProfileAsset(photoFile, resolvedStudentId, 'photo');
        uploadedPhotoUrl = withCacheBust(uploaded.url || null);
      }

      if (signatureFile) {
        const uploaded = await uploadStudentProfileAsset(signatureFile, resolvedStudentId, 'signature');
        uploadedSignatureUrl = withCacheBust(uploaded.url || null);
      }

      const assets = await getStudentProfileAssets(resolvedStudentId, resolvedProfileId);
      setProfileAssets({
        ...assets,
        photoUrl: uploadedPhotoUrl || assets.photoUrl,
        signatureUrl: uploadedSignatureUrl || assets.signatureUrl,
        photoFileName: photoFile?.name || assets.photoFileName,
        signatureFileName: signatureFile?.name || assets.signatureFileName,
      });
      void queryClient.invalidateQueries({
        queryKey: studentProfileAssetsQueryKey(resolvedStudentId, resolvedProfileId),
      });
      setPhotoFile(null);
      setSignatureFile(null);

      // Keep the just-saved values even if auth refresh returns a partial student payload.
      setFormData(nextStateFromResult);
      void refresh();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gc-profile-assets-updated'));
      }

      toast.success('Profile updated successfully.');
    } catch (error) {
      console.error('Error updating student profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-8">
      <StudentPageIntro
        title="Profile"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.85fr)] xl:items-start">
        <form onSubmit={handleSubmit} className="space-y-6">
        <StudentProfileFormCard
          value={formData}
          onChange={(field, value) => updateField(field as keyof StudentProfileFormState, value as StudentProfileFormState[keyof StudentProfileFormState])}
          title="Student Information"
          hasValidBirthday={hasValidBirthday}
          hasValidContactNumber={hasValidContactNumber}
        />

        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
            <CardTitle className="text-xl font-semibold text-on-surface">Student Assets</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <ImageIcon className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-on-surface">1x1 Student Photo</p>
                </div>
              </div>
              <FilePickerButton
                accept={PROFILE_ASSET_ACCEPT_ATTRIBUTE}
                ariaLabel="Choose 1x1 student photo"
                disabled={saving}
                loading={isUploadingAssets}
                onFileSelected={(file) => handleAssetChange('photo', file)}
              >
                Choose Photo
              </FilePickerButton>
              <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                  {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt="Student profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No photo</span>
                  )}
                </div>
                <div className="w-full min-w-0 text-sm">
                  {photoFile ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="h-4 w-4" />
                      <span className="block min-w-0 truncate" title={photoFile.name}>{photoFile.name}</span>
                    </div>
                  ) : profileAssets.photoFileName ? (
                    <p className="truncate text-on-surface-variant" title={profileAssets.photoFileName}>{profileAssets.photoFileName}</p>
                  ) : loadingAssets ? (
                    <p className="text-on-surface-variant">Loading current photo...</p>
                  ) : (
                    <p className="text-amber-700">No saved photo yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <PenLine className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-on-surface">Signature of Student</p>
                </div>
              </div>
              <FilePickerButton
                accept={PROFILE_ASSET_ACCEPT_ATTRIBUTE}
                ariaLabel="Choose student signature image"
                disabled={saving}
                loading={isUploadingAssets}
                onFileSelected={(file) => handleAssetChange('signature', file)}
              >
                Choose Signature
              </FilePickerButton>
              <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex h-24 w-full max-w-[10rem] items-center justify-center overflow-hidden rounded-2xl border bg-white px-3">
                  {currentSignatureUrl ? (
                    <img src={currentSignatureUrl} alt="Student signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No signature</span>
                  )}
                </div>
                <div className="w-full min-w-0 text-sm">
                  {signatureFile ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="h-4 w-4" />
                      <span className="block min-w-0 truncate" title={signatureFile.name}>{signatureFile.name}</span>
                    </div>
                  ) : profileAssets.signatureFileName ? (
                    <p className="truncate text-on-surface-variant" title={profileAssets.signatureFileName}>{profileAssets.signatureFileName}</p>
                  ) : loadingAssets ? (
                    <p className="text-on-surface-variant">Loading current signature...</p>
                  ) : (
                    <p className="text-amber-700">No saved signature yet.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-3 border-t border-outline-variant/30 bg-surface-container-low px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-on-surface-variant sm:text-sm">
              {hasChanges ? 'You have unsaved profile changes.' : 'Your profile and student assets are up to date.'}
            </p>
            <Button
              type="submit"
              disabled={saving || !hasChanges || !isValid}
              loading={isUploadingAssets}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
        </form>

        <div className="space-y-6 xl:sticky xl:top-24">
          <PasswordChangeCard title="Change Password" />

          <SettingsLogoutCard className="flex justify-end" />
        </div>
      </div>
    </div>
  );
}
