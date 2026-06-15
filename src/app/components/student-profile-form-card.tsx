import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from './ui/utils';
import { DEPARTMENT_OPTIONS, getProgramOptionsForSelect, YEAR_LEVELS } from '../pages/student/medical-form/constants';

export type StudentProfileFormValue = {
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

export type StudentProfileExtraField = {
  id: string;
  label: string;
  value: string;
};

type StudentProfileFormCardProps = {
  value: StudentProfileFormValue;
  onChange?: (field: keyof StudentProfileFormValue, value: string) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
  extraFields?: StudentProfileExtraField[];
  hasValidBirthday?: boolean;
  hasValidContactNumber?: boolean;
  yearLevelLabel?: string;
};

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

function formatReadOnlyDate(value: string) {
  const parsed = parseDateInputValue(value);
  return parsed ? format(parsed, 'MMMM d, yyyy') : value;
}

function formatReadOnlySex(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'male') return 'Male';
  if (normalized.toLowerCase() === 'female') return 'Female';
  return normalized;
}

function formatReadOnlyYearLevel(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return YEAR_LEVELS.find((option) => option.value === normalized)?.label || normalized;
}

export function StudentProfileFormCard({
  value,
  onChange,
  readOnly = false,
  title = 'Student Information',
  description,
  extraFields = [],
  hasValidBirthday = true,
  hasValidContactNumber = true,
  yearLevelLabel = 'Year Level',
}: StudentProfileFormCardProps) {
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const maxBirthdate = useMemo(() => getMaxBirthdateIso(16), []);
  const selectedBirthday = useMemo(() => parseDateInputValue(value.birthday), [value.birthday]);
  const maxBirthdateDate = useMemo(() => parseDateInputValue(maxBirthdate), [maxBirthdate]);
  const birthdayFromYear = useMemo(() => new Date().getFullYear() - 100, []);
  const birthdayToYear = useMemo(
    () => maxBirthdateDate?.getFullYear() || new Date().getFullYear(),
    [maxBirthdateDate],
  );
  const birthdayYearOptions = useMemo(
    () => Array.from({ length: birthdayToYear - birthdayFromYear + 1 }, (_, index) => birthdayToYear - index),
    [birthdayFromYear, birthdayToYear],
  );
  const birthdayMinMonth = useMemo(() => new Date(birthdayFromYear, 0, 1), [birthdayFromYear]);
  const birthdayMaxMonth = useMemo(
    () => startOfMonth(maxBirthdateDate || new Date()),
    [maxBirthdateDate],
  );
  const [birthdayPickerMonth, setBirthdayPickerMonth] = useState<Date>(() => startOfMonth(new Date()));

  useEffect(() => {
    if (!birthdayPickerOpen) return;

    const nextMonth = selectedBirthday || maxBirthdateDate || new Date();
    const normalizedMonth = startOfMonth(nextMonth);
    if (normalizedMonth < birthdayMinMonth) {
      setBirthdayPickerMonth(birthdayMinMonth);
      return;
    }
    if (normalizedMonth > birthdayMaxMonth) {
      setBirthdayPickerMonth(birthdayMaxMonth);
      return;
    }
    setBirthdayPickerMonth(normalizedMonth);
  }, [birthdayMaxMonth, birthdayMinMonth, birthdayPickerOpen, maxBirthdateDate, selectedBirthday]);

  const canGoToPreviousBirthdayMonth = birthdayPickerMonth > birthdayMinMonth;
  const canGoToNextBirthdayMonth = birthdayPickerMonth < birthdayMaxMonth;
  const handleChange = (field: keyof StudentProfileFormValue, nextValue: string) => {
    if (!readOnly) {
      onChange?.(field, nextValue);
    }
  };

  const requiredFieldClass = (missing: boolean) =>
    !readOnly && missing ? 'border-red-500 ring-1 ring-red-200 focus-visible:ring-red-300' : '';
  const disabledFieldClass = readOnly ? 'cursor-not-allowed opacity-80' : '';

  return (
    <Card className="box-border w-full min-w-0 overflow-hidden rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest !gap-0">
      <CardHeader className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <CardTitle className="text-xl font-semibold text-on-surface">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid w-full min-w-0 gap-5 px-4 pt-4 sm:px-6 md:grid-cols-2">
        <div className="w-full min-w-0">
          <Label htmlFor="studentId">Student ID</Label>
          <Input id="studentId" value={value.studentId} readOnly disabled className="cursor-not-allowed opacity-80" />
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={value.firstName}
            onChange={(event) => handleChange('firstName', event.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder={readOnly ? '' : 'Required'}
            className={`${disabledFieldClass} ${requiredFieldClass(!value.firstName.trim())}`.trim()}
          />
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={value.lastName}
            onChange={(event) => handleChange('lastName', event.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder={readOnly ? '' : 'Required'}
            className={`${disabledFieldClass} ${requiredFieldClass(!value.lastName.trim())}`.trim()}
          />
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="middleInitial">Middle Initial</Label>
          <Input
            id="middleInitial"
            value={value.middleInitial}
            onChange={(event) => handleChange('middleInitial', event.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder={readOnly ? '' : 'Required'}
            maxLength={2}
            className={`${disabledFieldClass} ${requiredFieldClass(!value.middleInitial.trim())}`.trim()}
          />
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="text"
            value={value.age}
            readOnly
            disabled
            placeholder="Auto-calculated from birthday"
            className={`cursor-not-allowed opacity-80 ${requiredFieldClass(!value.age.trim())}`}
          />
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="sex">Sex at Birth</Label>
          {readOnly ? (
            <Input id="sex" value={formatReadOnlySex(value.sex)} readOnly disabled className="cursor-not-allowed opacity-80" />
          ) : (
            <Select value={value.sex || undefined} onValueChange={(nextValue) => handleChange('sex', nextValue)}>
              <SelectTrigger id="sex" className={requiredFieldClass(!value.sex.trim())}>
                <SelectValue placeholder="Required: select sex at birth" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="w-full min-w-0 md:col-span-2">
          <div className="grid w-full min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
            <div className="w-full min-w-0">
              <Label htmlFor="department">Department</Label>
              {readOnly ? (
                <Input id="department" value={value.department} readOnly disabled className="cursor-not-allowed opacity-80" />
              ) : (
                <Select value={value.department} onValueChange={(nextValue) => handleChange('department', nextValue)}>
                  <SelectTrigger id="department" className={requiredFieldClass(!value.department.trim())}>
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
              )}
            </div>
            <div className="w-full min-w-0">
              <Label htmlFor="course">Course / Program</Label>
              {readOnly ? (
                <Input id="course" value={value.course} readOnly disabled className="cursor-not-allowed opacity-80" />
              ) : (
                <Select
                  value={value.course || undefined}
                  onValueChange={(nextValue) => handleChange('course', nextValue)}
                  disabled={!value.department}
                >
                  <SelectTrigger id="course" className={requiredFieldClass(!value.course.trim())}>
                    <SelectValue placeholder={value.department ? 'Required: select program' : 'Select department first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getProgramOptionsForSelect(value.department, value.course).map((program) => (
                      <SelectItem key={program} value={program}>
                        {program}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="yearLevel">{yearLevelLabel}</Label>
          {readOnly ? (
            <Input
              id="yearLevel"
              value={formatReadOnlyYearLevel(value.yearLevel)}
              readOnly
              disabled
              className="cursor-not-allowed opacity-80"
            />
          ) : (
            <Select value={value.yearLevel || undefined} onValueChange={(nextValue) => handleChange('yearLevel', nextValue)}>
              <SelectTrigger id="yearLevel" className={requiredFieldClass(!value.yearLevel.trim())}>
                <SelectValue placeholder="Required: select year level" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_LEVELS.map((yearLevel) => (
                  <SelectItem key={yearLevel.value} value={yearLevel.value}>
                    {yearLevel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {extraFields.map((field) => (
          <div key={field.id} className="w-full min-w-0">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input id={field.id} value={field.value} readOnly disabled className="cursor-not-allowed opacity-80" />
          </div>
        ))}
        <div className="w-full min-w-0">
          <Label htmlFor="birthday">Birthday</Label>
          {readOnly ? (
            <Input
              id="birthday"
              value={formatReadOnlyDate(value.birthday)}
              readOnly
              disabled
              className="cursor-not-allowed opacity-80"
            />
          ) : (
            <>
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
                      requiredFieldClass(!value.birthday.trim() || !hasValidBirthday),
                    )}
                  >
                    {selectedBirthday ? format(selectedBirthday, 'MMMM d, yyyy') : 'Select birthday'}
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(92vw,24rem)] rounded-[18px] p-0" align="start">
                  <div className="border-b border-border/60 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-[18px]"
                        onClick={() => canGoToPreviousBirthdayMonth && setBirthdayPickerMonth((prev) => shiftMonth(prev, -1))}
                        disabled={!canGoToPreviousBirthdayMonth}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem]">
                        <Select
                          value={String(birthdayPickerMonth.getMonth())}
                          onValueChange={(nextValue) =>
                            setBirthdayPickerMonth(
                              startOfMonth(
                                new Date(
                                  birthdayPickerMonth.getFullYear(),
                                  Number.parseInt(nextValue, 10),
                                  1,
                                ),
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-9 rounded-[18px] bg-input-background">
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
                          onValueChange={(nextValue) =>
                            setBirthdayPickerMonth(
                              startOfMonth(
                                new Date(
                                  Number.parseInt(nextValue, 10),
                                  birthdayPickerMonth.getMonth(),
                                  1,
                                ),
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-9 rounded-[18px] bg-input-background">
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
                        className="h-9 w-9 rounded-[18px]"
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
                      handleChange('birthday', date ? formatDateInputValue(date) : '');
                      if (date) {
                        setBirthdayPickerOpen(false);
                      }
                    }}
                    month={birthdayPickerMonth}
                    onMonthChange={(date) => setBirthdayPickerMonth(startOfMonth(date))}
                    disabled={(date) => !!maxBirthdateDate && date > maxBirthdateDate}
                    className="px-2 pb-3 pt-2"
                    classNames={{ caption: 'hidden', nav: 'hidden' }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {!hasValidBirthday && value.birthday ? (
                <p className="mt-1 text-sm text-red-600">Student must be at least 16 years old.</p>
              ) : null}
            </>
          )}
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="civilStatus">Civil Status</Label>
          {readOnly ? (
            <Input id="civilStatus" value={value.civilStatus} readOnly disabled className="cursor-not-allowed opacity-80" />
          ) : (
            <Select value={value.civilStatus} onValueChange={(nextValue) => handleChange('civilStatus', nextValue)}>
              <SelectTrigger id="civilStatus" className={requiredFieldClass(!value.civilStatus.trim())}>
                <SelectValue placeholder="Required: select civil status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="contactNumber">Contact Number</Label>
          <Input
            id="contactNumber"
            type="tel"
            value={value.contactNumber}
            onChange={(event) => handleChange('contactNumber', event.target.value)}
            inputMode="numeric"
            readOnly={readOnly}
            disabled={readOnly}
            maxLength={11}
            placeholder={readOnly ? '' : '09XXXXXXXXX'}
            className={`${disabledFieldClass} ${requiredFieldClass(!value.contactNumber.trim() || !hasValidContactNumber)}`.trim()}
          />
          {!readOnly && !hasValidContactNumber && value.contactNumber ? (
            <p className="mt-1 text-sm text-red-600">Use exactly 11 digits starting with 09.</p>
          ) : null}
        </div>
        <div className="w-full min-w-0">
          <Label htmlFor="address">Street Address</Label>
          <Input
            id="address"
            value={value.address}
            onChange={(event) => handleChange('address', event.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder={readOnly ? '' : 'Required'}
            className={`${disabledFieldClass} ${requiredFieldClass(!value.address.trim())}`.trim()}
          />
        </div>
      </CardContent>
    </Card>
  );
}
