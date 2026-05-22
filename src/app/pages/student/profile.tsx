import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronLeft, ChevronRight, ImageIcon, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Calendar } from '../../components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import StudentPageIntro from '../../components/student-page-intro';
import PasswordChangeCard from '../../components/password-change-card';
import SettingsLogoutCard from '../../components/settings-logout-card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cn } from '../../components/ui/utils';
import {
  getStudentProfileAssets,
  updateStudentProfile,
  uploadStudentProfileAsset,
  type AuthMe,
  type StudentProfileAssets,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  resolveStudentSubmissionProfile,
  toCategoryLabel,
  type StudentSubmissionCategory,
  writeStudentSubmissionProfile,
} from '../../lib/student-submission-profile';
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
  middleInitial: string;
  department: string;
  course: string;
  age: string;
  sex: string;
  birthday: string;
  civilStatus: string;
  contactNumber: string;
  address: string;
  submissionCategory: StudentSubmissionCategory;
  submissionTargetYearLevel: string;
};

const MAX_NAME_LENGTH = 30;
const MIN_PROFILE_AGE = 16;
const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function sanitizeName(value: string) {
  return String(value).normalize('NFC').replace(/[^\p{L}\s'-]/gu, '').slice(0, MAX_NAME_LENGTH);
}

function sanitizeAddress(value: string) {
  return String(value)
    .replace(/[<>`]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .slice(0, 180);
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function getMaxBirthdateIso(minAge: number) {
  const today = new Date();
  const max = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return formatDateInputValue(max);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
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
  const submissionProfile = resolveStudentSubmissionProfile(me as AuthMe | null);
  const birthday = me?.student?.birthday || '';
  const derivedAge = calculateAgeFromBirthdate(birthday);
  return {
    studentId: me?.student?.student_id || me?.profile.student_id || '',
    firstName: sanitizeName(me?.student?.first_name || me?.profile.first_name || ''),
    lastName: sanitizeName(me?.student?.last_name || me?.profile.last_name || ''),
    middleInitial: String(me?.student?.middle_initial || '').replace(/[^A-Za-z]/g, '').slice(0, 1),
    department,
    course: normalizeProgramForDepartment(department, me?.student?.course || me?.profile.course || ''),
    age: derivedAge !== null ? String(derivedAge) : (me?.student?.age ? String(me.student.age) : ''),
    sex: me?.student?.sex || 'female',
    birthday,
    civilStatus: me?.student?.civil_status || 'Single',
    contactNumber: formatPhilippinePhoneInput(me?.student?.contact_number || ''),
    address: sanitizeAddress(me?.student?.address || ''),
    submissionCategory: submissionProfile.category,
    submissionTargetYearLevel: submissionProfile.targetYearLevel ? String(submissionProfile.targetYearLevel) : '',
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
  const initialFormData = useMemo(() => buildProfileFormState(me), [me]);
  const [formData, setFormData] = useState<StudentProfileFormState>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [profileAssets, setProfileAssets] = useState<StudentProfileAssets>(buildEmptyAssets);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [birthdayPickerMonth, setBirthdayPickerMonth] = useState<Date>(() => startOfMonth(new Date()));

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
  const hasValidBirthday =
    !formData.birthday.trim() || isAtLeastAge(formData.birthday, MIN_PROFILE_AGE);
  const maxBirthdate = useMemo(() => getMaxBirthdateIso(MIN_PROFILE_AGE), []);
  const selectedBirthday = useMemo(() => parseDateInputValue(formData.birthday), [formData.birthday]);
  const maxBirthdateDate = useMemo(() => parseDateInputValue(maxBirthdate), [maxBirthdate]);
  const birthdayFromYear = useMemo(() => new Date().getFullYear() - 100, []);
  const birthdayToYear = useMemo(() => maxBirthdateDate?.getFullYear() || new Date().getFullYear(), [maxBirthdateDate]);
  const birthdayYearOptions = useMemo(
    () => Array.from({ length: birthdayToYear - birthdayFromYear + 1 }, (_, index) => birthdayToYear - index),
    [birthdayFromYear, birthdayToYear],
  );
  const birthdayMinMonth = useMemo(() => new Date(birthdayFromYear, 0, 1), [birthdayFromYear]);
  const birthdayMaxMonth = useMemo(
    () => startOfMonth(maxBirthdateDate || new Date()),
    [maxBirthdateDate],
  );
  const canGoToPreviousBirthdayMonth = birthdayPickerMonth > birthdayMinMonth;
  const canGoToNextBirthdayMonth = birthdayPickerMonth < birthdayMaxMonth;
  const clampBirthdayPickerMonth = (date: Date) => {
    if (date < birthdayMinMonth) return birthdayMinMonth;
    if (date > birthdayMaxMonth) return birthdayMaxMonth;
    return startOfMonth(date);
  };
  const requiresYearOverride =
    formData.submissionCategory === 'returning' || formData.submissionCategory === 'repeater_irregular';

  useEffect(() => {
    if (!birthdayPickerOpen) return;
    setBirthdayPickerMonth(clampBirthdayPickerMonth(selectedBirthday || maxBirthdateDate || new Date()));
  }, [birthdayPickerOpen, maxBirthdateDate, selectedBirthday]);

  const isValid =
    Boolean(formData.studentId.trim()) &&
    Boolean(formData.firstName.trim()) &&
    Boolean(formData.lastName.trim()) &&
    Boolean(formData.middleInitial.trim()) &&
    Boolean(formData.department.trim()) &&
    Boolean(formData.course.trim()) &&
    Boolean(formData.age.trim()) &&
    Boolean(formData.sex.trim()) &&
    Boolean(formData.birthday.trim()) &&
    Boolean(formData.civilStatus.trim()) &&
    hasValidBirthday &&
    hasValidContactNumber &&
    (!requiresYearOverride || Boolean(formData.submissionTargetYearLevel));

  const currentPhotoUrl = photoPreviewUrl || profileAssets.photoUrl || null;
  const currentSignatureUrl = signaturePreviewUrl || profileAssets.signatureUrl || null;
  const requiredFieldClass = (missing: boolean) =>
    missing ? 'border-red-500 ring-1 ring-red-200 focus-visible:ring-red-300' : '';

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
        : field === 'submissionCategory'
        ? {
            submissionCategory: String(value) as StudentSubmissionCategory,
            submissionTargetYearLevel:
              String(value) === 'returning' || String(value) === 'repeater_irregular'
                ? prev.submissionTargetYearLevel
                : '',
          }
        : field === 'submissionTargetYearLevel'
        ? {
            submissionTargetYearLevel: String(value).replace(/\D/g, '').slice(0, 1),
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
      if (!hasValidBirthday) {
        toast.error('Birthday must be valid and for a student who is 16 years old or above.');
        return;
      }
      toast.error('Please complete the required profile fields before saving.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateStudentProfile({
        ...formData,
        submissionTargetYearLevel: formData.submissionTargetYearLevel
          ? Number.parseInt(formData.submissionTargetYearLevel, 10)
          : null,
      });
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
      setPhotoFile(null);
      setSignatureFile(null);

      // Keep the just-saved values even if auth refresh returns a partial student payload.
      setFormData(nextStateFromResult);
      if (resolvedStudentId) {
        writeStudentSubmissionProfile(resolvedStudentId, {
          category: formData.submissionCategory,
          targetYearLevel: formData.submissionTargetYearLevel
            ? Number.parseInt(formData.submissionTargetYearLevel, 10)
            : null,
        });
      }
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
        description="Keep your student information, 1x1 photo, and signature up to date. These saved assets are reused for your student records."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.85fr)] xl:items-start">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
            <CardTitle className="text-xl font-semibold text-on-surface">Student Information</CardTitle>
            <CardDescription>
              Your student ID is managed by your account. The rest of these details can be updated any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="studentId">Student ID</Label>
              <Input id="studentId" value={formData.studentId} readOnly disabled className="cursor-not-allowed opacity-80" />
            </div>
            <div className="min-w-0">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                placeholder="Required"
                className={requiredFieldClass(!formData.firstName.trim())}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                placeholder="Required"
                className={requiredFieldClass(!formData.lastName.trim())}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="middleInitial">Middle Initial *</Label>
              <Input
                id="middleInitial"
                value={formData.middleInitial}
                onChange={(event) => updateField('middleInitial', event.target.value)}
                placeholder="Required"
                maxLength={1}
                className={requiredFieldClass(!formData.middleInitial.trim())}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="text"
                value={formData.age}
                readOnly
                disabled
                placeholder="Auto-calculated from birthday"
                className={`cursor-not-allowed opacity-80 ${requiredFieldClass(!formData.age.trim())}`}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="sex">Sex at Birth *</Label>
              <Select value={formData.sex} onValueChange={(value) => updateField('sex', value)}>
                <SelectTrigger id="sex" className={requiredFieldClass(!formData.sex.trim())}>
                  <SelectValue placeholder="Required: select sex at birth" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 md:col-span-2">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="min-w-0">
                  <Label htmlFor="department">Department *</Label>
                  <Select value={formData.department} onValueChange={(value) => updateField('department', value)}>
                    <SelectTrigger id="department" className={requiredFieldClass(!formData.department.trim())}>
                      <SelectValue placeholder="Required: select department" />
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
                <div className="min-w-0">
                  <Label htmlFor="course">Course / Program *</Label>
                  <Select
                    value={formData.course || undefined}
                    onValueChange={(value) => updateField('course', value)}
                    disabled={!formData.department}
                  >
                    <SelectTrigger id="course" className={requiredFieldClass(!formData.course.trim())}>
                      <SelectValue placeholder={formData.department ? 'Required: select program' : 'Select department first'} />
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
              </div>
            </div>
            <div className="min-w-0">
              <Label htmlFor="birthday">Birthday *</Label>
              <Popover open={birthdayPickerOpen} onOpenChange={setBirthdayPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="birthday"
                    type="button"
                    variant="outline"
                    className={cn(
                      'border-input bg-input-background hover:bg-input-background focus-visible:border-ring focus-visible:ring-ring/50 w-full justify-between rounded-md border px-3 py-2 text-left font-normal text-foreground shadow-none focus-visible:ring-[3px]',
                      !selectedBirthday && 'text-muted-foreground',
                      'data-[state=open]:bg-input-background',
                      requiredFieldClass(!formData.birthday.trim() || !hasValidBirthday),
                    )}
                  >
                    {selectedBirthday ? format(selectedBirthday, 'MMMM d, yyyy') : 'Select birthday'}
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(92vw,24rem)] rounded-2xl p-0 shadow-xl" align="start">
                  <div className="border-b border-border/60 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => canGoToPreviousBirthdayMonth && setBirthdayPickerMonth((prev) => shiftMonth(prev, -1))}
                        disabled={!canGoToPreviousBirthdayMonth}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                        <Select
                          value={String(birthdayPickerMonth.getMonth())}
                          onValueChange={(value) =>
                            setBirthdayPickerMonth(
                              clampBirthdayPickerMonth(
                                new Date(
                                  birthdayPickerMonth.getFullYear(),
                                  Number.parseInt(value, 10),
                                  1,
                                ),
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-9 rounded-xl bg-input-background">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map((month, index) => (
                              <SelectItem key={month} value={String(index)}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(birthdayPickerMonth.getFullYear())}
                          onValueChange={(value) =>
                            setBirthdayPickerMonth(
                              clampBirthdayPickerMonth(
                                new Date(
                                  Number.parseInt(value, 10),
                                  birthdayPickerMonth.getMonth(),
                                  1,
                                ),
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-9 rounded-xl bg-input-background">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {birthdayYearOptions.map((year) => (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => canGoToNextBirthdayMonth && setBirthdayPickerMonth((prev) => shiftMonth(prev, 1))}
                        disabled={!canGoToNextBirthdayMonth}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Calendar
                    mode="single"
                    selected={selectedBirthday || undefined}
                    onSelect={(date) => {
                      updateField('birthday', date ? formatDateInputValue(date) : '');
                      if (date) {
                        setBirthdayPickerOpen(false);
                      }
                    }}
                    month={birthdayPickerMonth}
                    onMonthChange={(date) => setBirthdayPickerMonth(clampBirthdayPickerMonth(date))}
                    disabled={(date) => !!maxBirthdateDate && date > maxBirthdateDate}
                    className="px-2 pb-3 pt-2"
                    classNames={{ caption: 'hidden', nav: 'hidden' }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {!hasValidBirthday && formData.birthday ? (
                <p className="mt-1 text-sm text-red-600">Student must be at least 16 years old.</p>
              ) : null}
            </div>
            <div className="min-w-0">
              <Label htmlFor="civilStatus">Civil Status *</Label>
              <Select value={formData.civilStatus} onValueChange={(value) => updateField('civilStatus', value)}>
                <SelectTrigger id="civilStatus" className={requiredFieldClass(!formData.civilStatus.trim())}>
                  <SelectValue placeholder="Required: select civil status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married">Married</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="contactNumber">Contact Number *</Label>
              <Input
                id="contactNumber"
                type="tel"
                value={formData.contactNumber}
                onChange={(event) => updateField('contactNumber', event.target.value)}
                inputMode="numeric"
                placeholder="(+63) 9123456789"
                className={requiredFieldClass(!formData.contactNumber.trim() || !hasValidContactNumber)}
              />
              {!hasValidContactNumber && formData.contactNumber ? (
                <p className="mt-1 text-sm text-red-600">Use the format (+63) 9123456789.</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(event) => updateField('address', event.target.value)}
                placeholder="Required"
                className={requiredFieldClass(!formData.address.trim())}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="submissionCategory">Submission Status</Label>
              <Select value={formData.submissionCategory} onValueChange={(value) => updateField('submissionCategory', value as StudentSubmissionCategory)}>
                <SelectTrigger id="submissionCategory">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">{toCategoryLabel('regular')}</SelectItem>
                  <SelectItem value="returning">{toCategoryLabel('returning')}</SelectItem>
                  <SelectItem value="repeater_irregular">{toCategoryLabel('repeater_irregular')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {requiresYearOverride ? (
              <div className="min-w-0">
                <Label htmlFor="submissionTargetYearLevel">Submission Year *</Label>
                <Select
                  value={formData.submissionTargetYearLevel || undefined}
                  onValueChange={(value) => updateField('submissionTargetYearLevel', value)}
                >
                  <SelectTrigger id="submissionTargetYearLevel" className={requiredFieldClass(!formData.submissionTargetYearLevel)}>
                    <SelectValue placeholder="Select year to open" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st Year</SelectItem>
                    <SelectItem value="2">2nd Year</SelectItem>
                    <SelectItem value="3">3rd Year</SelectItem>
                    <SelectItem value="4">4th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
            <CardTitle className="text-xl font-semibold text-on-surface">Student Assets</CardTitle>
            <CardDescription>
              Upload your 1x1 photo and signature here. These are no longer attached during Submit Record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5">
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
                className="hidden"
              />
              <label
                htmlFor="profilePhoto"
                className="inline-flex h-10 cursor-pointer items-center rounded-md border border-outline-variant/40 bg-white px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low"
              >
                Choose Photo
              </label>
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
                  <p className="text-sm text-on-surface-variant">PNG or JPG, max 5 MB</p>
                </div>
              </div>
              <Input
                id="studentSignature"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(event) => handleAssetChange('signature', event.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="studentSignature"
                className="inline-flex h-10 cursor-pointer items-center rounded-md border border-outline-variant/40 bg-white px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low"
              >
                Choose Signature
              </label>
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
            <Button type="submit" disabled={saving || !hasChanges || !isValid} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </form>

        <div className="space-y-6 xl:sticky xl:top-24">
      <PasswordChangeCard title="Change Password" description="Update the password for your student account." />

      <SettingsLogoutCard className="flex justify-end" />
        </div>
      </div>
    </div>
  );
}
