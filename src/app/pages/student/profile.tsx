import { useEffect, useMemo, useState } from 'react';
import { Check, ImageIcon, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import PasswordChangeCard from '../../components/password-change-card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  getStudentProfileAssets,
  updateStudentProfile,
  uploadStudentProfileAsset,
  type AuthMe,
  type StudentProfileAssets,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  DEPARTMENT_OPTIONS,
  formatPhilippinePhoneInput,
  getProgramOptionsForSelect,
  isValidPhilippinePhoneNumber,
  normalizeProgramForDepartment,
  resolveDepartmentValue,
} from './medical-form/constants';

type StudentProfileFormState = {
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  course: string;
  birthday: string;
  contactNumber: string;
  address: string;
};

function buildProfileFormState(me?: Pick<AuthMe, 'profile' | 'student'> | null): StudentProfileFormState {
  const department = resolveDepartmentValue(me?.student?.department || me?.profile.department || '');
  return {
    studentId: me?.student?.student_id || me?.profile.student_id || '',
    firstName: me?.student?.first_name || me?.profile.first_name || '',
    lastName: me?.student?.last_name || me?.profile.last_name || '',
    department,
    course: normalizeProgramForDepartment(department, me?.student?.course || me?.profile.course || ''),
    birthday: me?.student?.birthday || '',
    contactNumber: formatPhilippinePhoneInput(me?.student?.contact_number || ''),
    address: me?.student?.address || '',
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

export default function StudentProfile() {
  const { me, refresh } = useAuth();
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
  const hasValidContactNumber =
    !formData.contactNumber.trim() || isValidPhilippinePhoneNumber(formData.contactNumber);

  const isValid =
    Boolean(formData.studentId.trim()) &&
    Boolean(formData.firstName.trim()) &&
    Boolean(formData.lastName.trim()) &&
    Boolean(formData.department.trim()) &&
    Boolean(formData.course.trim()) &&
    Boolean(formData.birthday.trim()) &&
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

    if (!file.type.startsWith('image/')) {
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
      toast.error('Please complete the required profile fields before saving.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateStudentProfile(formData);
      const nextState = buildProfileFormState({
        profile: result.profile,
        student: result.student,
      });
      const resolvedStudentId = result.student?.student_id || nextState.studentId;
      const resolvedProfileId = result.student?.profile_id || me?.student?.profile_id || result.profile.id;

      if (photoFile) {
        await uploadStudentProfileAsset(photoFile, resolvedStudentId, 'photo');
      }

      if (signatureFile) {
        await uploadStudentProfileAsset(signatureFile, resolvedStudentId, 'signature');
      }

      const assets = await getStudentProfileAssets(resolvedStudentId, resolvedProfileId);
      setFormData(nextState);
      setProfileAssets(assets);
      setPhotoFile(null);
      setSignatureFile(null);

      await refresh();

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
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
          Keep your student information, 1x1 photo, and signature up to date. These saved assets are reused for your student records.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
            <CardTitle className="text-xl font-semibold text-on-surface">Student Information</CardTitle>
            <CardDescription>
              Your student ID is managed by your account. The rest of these details can be updated any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
            <div>
              <Label htmlFor="studentId">Student ID</Label>
              <Input id="studentId" value={formData.studentId} readOnly disabled className="cursor-not-allowed opacity-80" />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={formData.department} onValueChange={(value) => updateField('department', value)}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((department) => (
                    <SelectItem key={department.value} value={department.value}>
                      {department.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                placeholder="Enter your last name"
              />
            </div>
            <div>
              <Label htmlFor="course">Course / Program</Label>
              <Select
                value={formData.course || undefined}
                onValueChange={(value) => updateField('course', value)}
                disabled={!formData.department}
              >
                <SelectTrigger id="course">
                  <SelectValue placeholder={formData.department ? 'Select program' : 'Select department first'} />
                </SelectTrigger>
                <SelectContent>
                  {getProgramOptionsForSelect(formData.department, formData.course).map((program) => (
                    <SelectItem key={program} value={program}>
                      {program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(event) => updateField('birthday', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                type="tel"
                value={formData.contactNumber}
                onChange={(event) => updateField('contactNumber', event.target.value)}
                inputMode="numeric"
                placeholder="(+63) 9123456789"
              />
              {!hasValidContactNumber && formData.contactNumber ? (
                <p className="mt-1 text-sm text-red-600">Use the format (+63) 9123456789.</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(event) => updateField('address', event.target.value)}
                placeholder="Enter your street address"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
            <CardTitle className="text-xl font-semibold text-on-surface">Student Assets</CardTitle>
            <CardDescription>
              Upload your 1x1 photo and signature here. These are no longer attached during Submit Record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 pt-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
              <div className="mb-4 flex items-center gap-3">
                <ImageIcon className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-on-surface">1x1 Student Photo</p>
                  <p className="text-sm text-on-surface-variant">JPEG or PNG, max 5 MB</p>
                </div>
              </div>
              <Input
                id="profilePhoto"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(event) => handleAssetChange('photo', event.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                  {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt="Student profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No photo</span>
                  )}
                </div>
                <div className="text-sm">
                  {photoFile ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="h-4 w-4" />
                      <span>{photoFile.name}</span>
                    </div>
                  ) : profileAssets.photoFileName ? (
                    <p className="text-on-surface-variant">{profileAssets.photoFileName}</p>
                  ) : loadingAssets ? (
                    <p className="text-on-surface-variant">Loading current photo...</p>
                  ) : (
                    <p className="text-amber-700">No saved photo yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
              <div className="mb-4 flex items-center gap-3">
                <PenLine className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-on-surface">Signature of Student</p>
                  <p className="text-sm text-on-surface-variant">PNG or JPG, max 5 MB</p>
                </div>
              </div>
              <Input
                id="studentSignature"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(event) => handleAssetChange('signature', event.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-2xl border bg-white px-3">
                  {currentSignatureUrl ? (
                    <img src={currentSignatureUrl} alt="Student signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No signature</span>
                  )}
                </div>
                <div className="text-sm">
                  {signatureFile ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="h-4 w-4" />
                      <span>{signatureFile.name}</span>
                    </div>
                  ) : profileAssets.signatureFileName ? (
                    <p className="text-on-surface-variant">{profileAssets.signatureFileName}</p>
                  ) : loadingAssets ? (
                    <p className="text-on-surface-variant">Loading current signature...</p>
                  ) : (
                    <p className="text-amber-700">No saved signature yet.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-outline-variant/30 bg-surface-container-low px-6 py-4">
            <p className="text-sm text-on-surface-variant">
              {hasChanges ? 'You have unsaved profile changes.' : 'Your profile and student assets are up to date.'}
            </p>
            <Button type="submit" disabled={saving || !hasChanges || !isValid}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <PasswordChangeCard title="Change Password" description="Update the password for your student account." />
    </div>
  );
}
