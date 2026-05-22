import { memo } from 'react';
import { CheckCircle2, PenLine, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

import { Textarea } from '../../../components/ui/textarea';
import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  LAB_TEST_SITE_OPTIONS,
  MEDICAL_CONDITIONS,
  YEAR_LEVELS,
} from './constants';
import type { MedicalConditionKey, MedicalFormData } from './types';

type Props = {
  step: number;
  formData: MedicalFormData;
  onFieldChange: <K extends keyof MedicalFormData>(field: K, value: MedicalFormData[K]) => void;
  onEmergencyContactChange: (field: 'name' | 'relationship' | 'phone' | 'address', value: string) => void;
  onMedicalConditionChange: (condition: MedicalConditionKey, checked: boolean) => void;
  hasRequiredProfileFields: boolean;
  hasProfilePhoto: boolean;
  hasProfileSignature: boolean;
  submitBlockers: string[];
  onGoToProfile: () => void;
};

export const MedicalFormStepContent = memo(function MedicalFormStepContent({
  step,
  formData,
  onFieldChange,
  onEmergencyContactChange,
  onMedicalConditionChange,
  hasRequiredProfileFields,
  hasProfilePhoto,
  hasProfileSignature,
  submitBlockers,
  onGoToProfile,
}: Props) {
  const stepOneReady = hasRequiredProfileFields && hasProfilePhoto && hasProfileSignature;
  const stepThreeMissingRequired = [
    !formData.hadOperation,
    !formData.emergencyContact.name?.trim(),
    !formData.emergencyContact.relationship?.trim(),
    !formData.emergencyContact.phone?.trim(),
    formData.emergencyContact.phone ? !/^\(\+63\)\s9\d{9}$/.test(formData.emergencyContact.phone.trim()) : false,
    !formData.emergencyContact.address?.trim(),
  ].filter(Boolean).length;

  const requiredFieldClass = (missing: boolean) =>
    missing ? 'border-red-500 ring-1 ring-red-200 focus-visible:ring-red-300' : '';
  const relationshipOptions = formData.emergencyContact.relationship &&
    !EMERGENCY_CONTACT_RELATIONSHIPS.includes(
      formData.emergencyContact.relationship as (typeof EMERGENCY_CONTACT_RELATIONSHIPS)[number],
    )
      ? [formData.emergencyContact.relationship, ...EMERGENCY_CONTACT_RELATIONSHIPS]
      : EMERGENCY_CONTACT_RELATIONSHIPS;

  switch (step) {
    case 1:
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight">Personal Information</h3>
            <p className="text-sm text-muted-foreground">
              Personal information is now managed in your Profile page. Complete your Profile first before proceeding.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
            <div className="flex items-center justify-between rounded-lg border border-outline-variant/30 bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserRound className={`h-5 w-5 ${hasRequiredProfileFields ? 'text-green-600' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium text-on-surface">Required Profile Fields</span>
              </div>
              <span className={`text-sm ${hasRequiredProfileFields ? 'text-green-700' : 'text-amber-700'}`}>
                {hasRequiredProfileFields ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-outline-variant/30 bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${hasProfilePhoto ? 'text-green-600' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium text-on-surface">1x1 Student Photo</span>
              </div>
              <span className={`text-sm ${hasProfilePhoto ? 'text-green-700' : 'text-amber-700'}`}>
                {hasProfilePhoto ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-outline-variant/30 bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <PenLine className={`h-5 w-5 ${hasProfileSignature ? 'text-green-600' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium text-on-surface">Student Signature</span>
              </div>
              <span className={`text-sm ${hasProfileSignature ? 'text-green-700' : 'text-amber-700'}`}>
                {hasProfileSignature ? 'Ready' : 'Missing'}
              </span>
            </div>
          </div>

          {!stepOneReady ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>Fill up the fields in Profile and upload your photo/signature to proceed.</p>
              </div>
              <Button type="button" variant="outline" onClick={onGoToProfile}>
                Go to Profile
              </Button>
            </div>
          ) : null}
        </div>
      );
    case 2:
      return (
        <div className="space-y-4">
          <h3 className="mb-2 text-xl font-semibold">Medical History</h3>
          <p className="mb-4 text-sm text-muted-foreground">Place a check on conditions that apply to you</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {MEDICAL_CONDITIONS.map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={formData.medicalHistory[key]}
                  onCheckedChange={(checked) => onMedicalConditionChange(key, checked === true)}
                  className="mt-0.5 size-4"
                />
                <Label htmlFor={key} className="text-sm font-normal">
                  {label}
                </Label>
                {key === 'others' && formData.medicalHistory.others ? (
                  <Input
                    id="otherMedicalHistory"
                    value={formData.otherMedicalHistory}
                    onChange={(event) => onFieldChange('otherMedicalHistory', event.target.value)}
                    placeholder="Please specify"
                    maxLength={20}
                    aria-required="true"
                    className={`ml-2 h-8 w-44 ${
                      !formData.otherMedicalHistory.trim() ? 'border-red-500 ring-1 ring-red-200' : ''
                    }`}
                  />
                ) : null}
              </div>
            ))}
          </div>
          {formData.medicalHistory.others ? (
            <p className="text-xs text-muted-foreground">Others accepts letters and spaces only, maximum of 20 characters.</p>
          ) : null}
          {formData.medicalHistory.allergy && (
            <div className="mt-4">
              <Label htmlFor="allergyDetails">Specify Allergy Type</Label>
              <Textarea
                id="allergyDetails"
                value={formData.allergyDetails}
                onChange={(event) => onFieldChange('allergyDetails', event.target.value)}
                placeholder="Please describe your allergies..."
              />
            </div>
          )}
        </div>
      );
    case 3:
      return (
        <div className="space-y-4">
          <h3 className="mb-4 text-xl font-semibold">Operations & Emergency Contact</h3>
          {stepThreeMissingRequired > 0 ? (
            <div className="break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Required fields are missing or invalid. Please complete all fields marked with{' '}
              <span className="font-semibold">*</span>.
            </div>
          ) : null}
          <div>
            <Label>Have you had any operation in the past? *</Label>
            <RadioGroup
              value={formData.hadOperation}
              onValueChange={(value) => onFieldChange('hadOperation', value as 'yes' | 'no')}
              className={requiredFieldClass(!formData.hadOperation)}
            >
              <div className="mt-2 flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="op-yes" />
                  <Label htmlFor="op-yes" className="font-normal">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="op-no" />
                  <Label htmlFor="op-no" className="font-normal">
                    No
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          {formData.hadOperation === 'yes' && (
            <div>
              <Label htmlFor="operationDetails">Nature of operation and date/year</Label>
              <Textarea
                id="operationDetails"
                value={formData.operationDetails}
                onChange={(event) => onFieldChange('operationDetails', event.target.value)}
                placeholder="Please describe the operation..."
                maxLength={120}
              />
            </div>
          )}
          <div className="mt-6 border-t pt-4">
            <h4 className="mb-4 font-semibold">Emergency Contact Person</h4>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label htmlFor="ecName">Name *</Label>
                <Input
                  id="ecName"
                  value={formData.emergencyContact.name}
                  onChange={(event) => onEmergencyContactChange('name', event.target.value)}
                  className={requiredFieldClass(!formData.emergencyContact.name?.trim())}
                />
              </div>
              <div>
                <Label htmlFor="ecRelationship">Relationship *</Label>
                <Select
                  value={formData.emergencyContact.relationship}
                  onValueChange={(value) => onEmergencyContactChange('relationship', value)}
                >
                  <SelectTrigger
                    id="ecRelationship"
                    className={requiredFieldClass(!formData.emergencyContact.relationship?.trim())}
                  >
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((relationship) => (
                      <SelectItem key={relationship} value={relationship}>
                        {relationship}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label htmlFor="ecPhone">Cellphone Number *</Label>
                <Input
                  id="ecPhone"
                  value={formData.emergencyContact.phone}
                  onChange={(event) => onEmergencyContactChange('phone', event.target.value)}
                  placeholder="(+63) 9123456789"
                  inputMode="numeric"
                  maxLength={16}
                  className={requiredFieldClass(
                    !formData.emergencyContact.phone?.trim() ||
                      !/^\(\+63\)\s9\d{9}$/.test(formData.emergencyContact.phone.trim()),
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">Use a valid Philippine mobile number starting with (+63).</p>
              </div>
              <div>
                <Label htmlFor="ecAddress">Address *</Label>
                <Input
                  id="ecAddress"
                  value={formData.emergencyContact.address}
                  onChange={(event) => onEmergencyContactChange('address', event.target.value)}
                  className={requiredFieldClass(!formData.emergencyContact.address?.trim())}
                />
              </div>
            </div>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="space-y-4">
          <h3 className="mb-4 text-xl font-semibold">Laboratory Test Sources</h3>
          <p className="text-sm text-muted-foreground">
            Select where each test was performed. Choose <span className="font-medium">Others</span> to type a custom clinic/lab name (max 50 letters and numbers).
          </p>
          <div className="grid gap-4">
            <div>
              <Label>Where did you do your CBC test? *</Label>
              <Select value={formData.cbcTestSite} onValueChange={(value) => onFieldChange('cbcTestSite', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select clinic/lab" />
                </SelectTrigger>
                <SelectContent>
                  {LAB_TEST_SITE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
              {formData.cbcTestSite === 'Others' ? (
                <Input
                  value={formData.cbcTestSiteOther}
                  onChange={(event) => onFieldChange('cbcTestSiteOther', event.target.value)}
                  className="mt-2"
                  maxLength={50}
                  placeholder="Enter clinic/lab"
                />
              ) : null}
            </div>
            <div>
              <Label>Where did you do your Urinalysis test? *</Label>
              <Select value={formData.urinalysisTestSite} onValueChange={(value) => onFieldChange('urinalysisTestSite', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select clinic/lab" />
                </SelectTrigger>
                <SelectContent>
                  {LAB_TEST_SITE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
              {formData.urinalysisTestSite === 'Others' ? (
                <Input
                  value={formData.urinalysisTestSiteOther}
                  onChange={(event) => onFieldChange('urinalysisTestSiteOther', event.target.value)}
                  className="mt-2"
                  maxLength={50}
                  placeholder="Enter clinic/lab"
                />
              ) : null}
            </div>
            <div>
              <Label>Where did you do your X-Ray test? *</Label>
              <Select value={formData.xrayTestSite} onValueChange={(value) => onFieldChange('xrayTestSite', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select clinic/lab" />
                </SelectTrigger>
                <SelectContent>
                  {LAB_TEST_SITE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
              {formData.xrayTestSite === 'Others' ? (
                <Input
                  value={formData.xrayTestSiteOther}
                  onChange={(event) => onFieldChange('xrayTestSiteOther', event.target.value)}
                  className="mt-2"
                  maxLength={50}
                  placeholder="Enter clinic/lab"
                />
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="physicalCopyAgreement"
                checked={formData.physicalCopyAgreement}
                onCheckedChange={(checked) => onFieldChange('physicalCopyAgreement', checked === true)}
                className="mt-1"
              />
              <Label htmlFor="physicalCopyAgreement" className="text-sm leading-6 font-normal">
                I agree to bring the physical copies of my CBC, Urinalysis, and X-ray test results during the day of my physical examination for verification and encoding by the clinic staff.
              </Label>
            </div>
          </div>
        </div>
      );
    case 5:
      return (
        <div className="space-y-4">
          <h3 className="mb-4 text-xl font-semibold">Review and Submit</h3>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-muted-foreground">Name:</p>
                <p className="break-words font-medium">
                  {formData.lastName}, {formData.firstName} {formData.middleInitial}
                </p>
                <p className="text-muted-foreground">Student ID:</p>
                <p className="break-all font-medium">{formData.studentId}</p>
                <p className="text-muted-foreground">Course/Dept:</p>
                <p className="break-words font-medium">
                  {formData.course} ({formData.department})
                </p>
                <p className="text-muted-foreground">Year Level:</p>
                <p className="font-medium">{YEAR_LEVELS.find((year) => year.value === formData.yearLevel)?.label}</p>
                <p className="text-muted-foreground">Birthday:</p>
                <p className="font-medium">{formData.birthday}</p>
                <p className="text-muted-foreground">Age / Sex:</p>
                <p className="font-medium">
                  {formData.age} / {formData.sex === 'female' ? 'F' : 'M'}
                </p>
                <p className="text-muted-foreground">Civil Status:</p>
                <p className="font-medium">{formData.civilStatus}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Medical History</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {Object.values(formData.medicalHistory).some(Boolean) ? (
                <div className="flex flex-wrap gap-2">
                  {MEDICAL_CONDITIONS.filter(({ key }) => formData.medicalHistory[key]).map(({ key, label }) => (
                    <span key={key} className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      {key === 'others' && formData.otherMedicalHistory.trim()
                        ? `${label}: ${formData.otherMedicalHistory.trim()}`
                        : label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No medical conditions reported</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Laboratory Test Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-muted-foreground">CBC:</p>
                <p className="font-medium">{formData.cbcTestSite === 'Others' ? formData.cbcTestSiteOther || 'Others' : formData.cbcTestSite || '--'}</p>
                <p className="text-muted-foreground">Urinalysis:</p>
                <p className="font-medium">{formData.urinalysisTestSite === 'Others' ? formData.urinalysisTestSiteOther || 'Others' : formData.urinalysisTestSite || '--'}</p>
                <p className="text-muted-foreground">X-Ray:</p>
                <p className="font-medium">{formData.xrayTestSite === 'Others' ? formData.xrayTestSiteOther || 'Others' : formData.xrayTestSite || '--'}</p>
              </div>
            </CardContent>
          </Card>
          {!formData.dataPrivacyConsent ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Data Privacy Consent is still required. Please return to <span className="font-semibold">Before You Continue</span> and check the consent box before submitting.
              </p>
            </div>
          ) : null}
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="submissionConfirmed"
                checked={formData.submissionConfirmed}
                onCheckedChange={(checked) => onFieldChange('submissionConfirmed', checked === true)}
                className="mt-1"
              />
              <Label htmlFor="submissionConfirmed" className="text-sm leading-6 font-normal">
                I confirm that all details and laboratory test source information are complete and true. I understand that
                inaccurate information may delay medical clearance.
              </Label>
            </div>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Please review all information carefully before submitting. Once submitted, your medical record will be reviewed by clinic staff.
            </p>
          </div>
          {submitBlockers.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Submission is currently blocked due to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {submitBlockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
    default:
      return null;
  }
});
