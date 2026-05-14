import { memo } from 'react';
import { Check, CheckCircle2, PenLine, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';

import { Textarea } from '../../../components/ui/textarea';
import {
  MEDICAL_CONDITIONS,
  YEAR_LEVELS,
} from './constants';
import type { BmiCategory, MedicalConditionKey, MedicalFormData } from './types';

type Props = {
  step: number;
  formData: MedicalFormData;
  onFieldChange: <K extends keyof MedicalFormData>(field: K, value: MedicalFormData[K]) => void;
  onEmergencyContactChange: (field: 'name' | 'relationship' | 'phone' | 'address', value: string) => void;
  onMedicalConditionChange: (condition: MedicalConditionKey, checked: boolean) => void;
  onMeasurementChange: (field: 'weight' | 'height', value: string) => void;
  onFileChange: (field: 'xrayFile' | 'cbcFile' | 'urinalysisFile', file: File | null) => void;
  getBmiCategory: (bmi: string) => BmiCategory;
  hasRequiredProfileFields: boolean;
  hasProfilePhoto: boolean;
  hasProfileSignature: boolean;
  onGoToProfile: () => void;
};

export const MedicalFormStepContent = memo(function MedicalFormStepContent({
  step,
  formData,
  onFieldChange,
  onEmergencyContactChange,
  onMedicalConditionChange,
  onMeasurementChange,
  onFileChange,
  getBmiCategory,
  hasRequiredProfileFields,
  hasProfilePhoto,
  hasProfileSignature,
  onGoToProfile,
}: Props) {
  const showLabUploads = formData.labTestLocation === 'other';
  const uploadsRequired = formData.labTestLocation === 'other';
  const hasXray = Boolean(formData.xrayFile || formData.existingXrayFileUrl);
  const stepOneReady = hasRequiredProfileFields && hasProfilePhoto && hasProfileSignature;
  const stepThreeMissingRequired = [
    !formData.hadOperation,
    !formData.emergencyContact.name?.trim(),
    !formData.emergencyContact.relationship?.trim(),
    !formData.emergencyContact.phone?.trim(),
    !formData.emergencyContact.address?.trim(),
  ].filter(Boolean).length;
  const stepFourMissingRequired = [
    !formData.weight?.trim(),
    !formData.height?.trim(),
    formData.weight ? !/^\d{1,3}$/.test(formData.weight.trim()) : false,
    formData.height ? !/^\d{1,3}$/.test(formData.height.trim()) : false,
  ].filter(Boolean).length;

  const requiredFieldClass = (missing: boolean) =>
    missing ? 'border-red-500 ring-1 ring-red-200 focus-visible:ring-red-300' : '';

  const getUploadedFileName = (url?: string) => {
    if (!url) return 'Uploaded file';
    try {
      const cleaned = url.split('?')[0] || url;
      const rawName = cleaned.split('/').pop() || 'Uploaded file';
      return decodeURIComponent(rawName);
    } catch {
      return 'Uploaded file';
    }
  };

  const getFileExtension = (url?: string) => {
    if (!url) return '';
    const cleaned = (url.split('?')[0] || '').toLowerCase();
    return cleaned.split('.').pop() || '';
  };

  const renderExistingFilePreview = (url?: string) => {
    if (!url) return null;
    const ext = getFileExtension(url);

    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return (
        <img
          src={url}
          alt="Current uploaded file"
          className="mt-2 max-h-48 w-full rounded-md border border-emerald-200 object-contain bg-white"
        />
      );
    }

    if (ext === 'pdf') {
      return (
        <iframe
          src={url}
          title="Current uploaded PDF"
          className="mt-2 h-56 w-full rounded-md border border-emerald-200 bg-white"
        />
      );
    }

    return null;
  };

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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
              </div>
            ))}
          </div>
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
              Required fields are missing. Please complete all fields marked with <span className="font-semibold">*</span>.
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
            <div className="grid gap-4 md:grid-cols-2">
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
                <Input
                  id="ecRelationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(event) => onEmergencyContactChange('relationship', event.target.value)}
                  className={requiredFieldClass(!formData.emergencyContact.relationship?.trim())}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ecPhone">Tel. phone No. CP *</Label>
                <Input
                  id="ecPhone"
                  value={formData.emergencyContact.phone}
                  onChange={(event) => onEmergencyContactChange('phone', event.target.value)}
                  className={requiredFieldClass(!formData.emergencyContact.phone?.trim())}
                />
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
          <h3 className="mb-4 text-xl font-semibold">Physical Measurements</h3>
          {stepFourMissingRequired > 0 ? (
            <div className="break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Required fields are missing or invalid. Please complete all fields marked with <span className="font-semibold">*</span>.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="weight">Weight (kg) *</Label>
              <Input
                id="weight"
                type="text"
                value={formData.weight}
                onChange={(event) => onMeasurementChange('weight', event.target.value)}
                placeholder="e.g., 065"
                inputMode="numeric"
                pattern="\d{1,3}"
                maxLength={3}
                className={requiredFieldClass(!formData.weight?.trim() || !/^\d{1,3}$/.test(formData.weight.trim()))}
              />
            </div>
            <div>
              <Label htmlFor="height">Height (cm) *</Label>
              <Input
                id="height"
                type="text"
                value={formData.height}
                onChange={(event) => onMeasurementChange('height', event.target.value)}
                placeholder="e.g., 170"
                inputMode="numeric"
                pattern="\d{1,3}"
                maxLength={3}
                className={requiredFieldClass(!formData.height?.trim() || !/^\d{1,3}$/.test(formData.height.trim()))}
              />
            </div>
            <div>
              <Label htmlFor="bmi">BMI (Auto-calculated)</Label>
              <Input id="bmi" value={formData.bmi} disabled className="bg-muted" />
            </div>
          </div>
          {formData.bmi && (
            <Card className="bg-primary/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="mb-2 text-sm text-muted-foreground">Your BMI Category</p>
                  <p className={`text-2xl font-bold ${getBmiCategory(formData.bmi).color}`}>{getBmiCategory(formData.bmi).category}</p>
                  <p className="mt-2 text-sm text-muted-foreground">BMI: {formData.bmi}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    case 5:
      return (
        <div className="space-y-4">
          <h3 className="mb-4 text-xl font-semibold">Laboratory Results Upload</h3>
          <div className="rounded-lg border bg-surface-container-low p-4">
            <Label>Did you take your tests at James L. Gordon Hospital? *</Label>
            <RadioGroup
              value={formData.labTestLocation}
              onValueChange={(value) => onFieldChange('labTestLocation', value as '' | 'jlgh' | 'other')}
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              <label className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                <RadioGroupItem value="jlgh" id="test-jlgh" />
                <span>Yes, at James L. Gordon Hospital</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                <RadioGroupItem value="other" id="test-other" />
                <span>No, from another clinic/lab</span>
              </label>
            </RadioGroup>
          </div>

          {formData.labTestLocation === 'jlgh' ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-emerald-700">No file attachment required.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Since you selected James L. Gordon Hospital, laboratory files do not need to be attached here.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {showLabUploads ? (
            <>
              {formData.labTestLocation === 'other' ? (
                <div>
                  <Label htmlFor="otherClinicName">Clinic/Laboratory Name *</Label>
                  <Input
                    id="otherClinicName"
                    value={formData.otherClinicName}
                    onChange={(event) => onFieldChange('otherClinicName', event.target.value)}
                    placeholder="Enter clinic or laboratory name"
                    className="mt-2"
                    maxLength={60}
                  />
                </div>
              ) : null}

              <p className="mb-1 text-sm text-muted-foreground">
                Upload your laboratory results (PDF, PNG, or JPG format, max 2MB per file)
                {uploadsRequired ? ' *' : ''}
              </p>
              <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="xray">Chest X-Ray *</Label>
                <Input
                  id="xray"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  aria-label="Upload chest X-ray result"
                  onChange={(event) => onFileChange('xrayFile', event.target.files?.[0] || null)}
                  className={`mt-2 cursor-pointer ${!hasXray ? 'border-red-500 ring-1 ring-red-200' : ''}`}
                />
                {formData.xrayFile && (
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <Check className="mr-2 h-4 w-4" />
                    {formData.xrayFile.name}
                  </div>
                )}
                {!formData.xrayFile && formData.existingXrayFileUrl && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <p className="font-medium">Current file: {getUploadedFileName(formData.existingXrayFileUrl)}</p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Choose a new file above if you want to replace this upload.
                    </p>
                    <a
                      href={formData.existingXrayFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold underline underline-offset-2"
                    >
                      View current file
                    </a>
                    {renderExistingFilePreview(formData.existingXrayFileUrl)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="cbc">Complete Blood Count (CBC) {uploadsRequired ? '*' : '(optional)'}</Label>
                <Input
                  id="cbc"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  aria-label="Upload complete blood count result"
                  onChange={(event) => onFileChange('cbcFile', event.target.files?.[0] || null)}
                  className="mt-2 cursor-pointer"
                />
                {formData.cbcFile && (
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <Check className="mr-2 h-4 w-4" />
                    {formData.cbcFile.name}
                  </div>
                )}
                {!formData.cbcFile && formData.existingCbcFileUrl && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <p className="font-medium">Current file: {getUploadedFileName(formData.existingCbcFileUrl)}</p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Choose a new file above if you want to replace this upload.
                    </p>
                    <a
                      href={formData.existingCbcFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold underline underline-offset-2"
                    >
                      View current file
                    </a>
                    {renderExistingFilePreview(formData.existingCbcFileUrl)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="urinalysis">Urinalysis (U/A) {uploadsRequired ? '*' : '(optional)'}</Label>
                <Input
                  id="urinalysis"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  aria-label="Upload urinalysis result"
                  onChange={(event) => onFileChange('urinalysisFile', event.target.files?.[0] || null)}
                  className="mt-2 cursor-pointer"
                />
                {formData.urinalysisFile && (
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <Check className="mr-2 h-4 w-4" />
                    {formData.urinalysisFile.name}
                  </div>
                )}
                {!formData.urinalysisFile && formData.existingUrinalysisFileUrl && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <p className="font-medium">Current file: {getUploadedFileName(formData.existingUrinalysisFileUrl)}</p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Choose a new file above if you want to replace this upload.
                    </p>
                    <a
                      href={formData.existingUrinalysisFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold underline underline-offset-2"
                    >
                      View current file
                    </a>
                    {renderExistingFilePreview(formData.existingUrinalysisFileUrl)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
            </>
          ) : null}
        </div>
      );
    case 6:
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
                      {label}
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
              <CardTitle className="text-lg">Physical Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-muted-foreground">Weight:</p>
                <p className="font-medium">{formData.weight} kg</p>
                <p className="text-muted-foreground">Height:</p>
                <p className="font-medium">{formData.height} cm</p>
                <p className="text-muted-foreground">BMI:</p>
                <p className="font-medium">{formData.bmi}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Uploaded Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="break-words">
                  Test Location:{' '}
                  {formData.labTestLocation === 'jlgh'
                    ? 'James L. Gordon Hospital'
                    : formData.labTestLocation === 'other'
                    ? formData.otherClinicName || 'Other clinic/lab'
                    : 'Not specified'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="break-words">Chest X-Ray: {formData.xrayFile?.name || (formData.existingXrayFileUrl ? 'Existing file on record' : 'Not provided')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="break-words">CBC: {formData.cbcFile?.name || (formData.existingCbcFileUrl ? 'Existing file on record' : 'Not provided')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="break-words">Urinalysis: {formData.urinalysisFile?.name || (formData.existingUrinalysisFileUrl ? 'Existing file on record' : 'Not provided')}</span>
              </div>
            </CardContent>
          </Card>
          <div
            className={`rounded-lg border p-4 ${
              formData.dataPrivacyConsent ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p className={`text-sm ${formData.dataPrivacyConsent ? 'text-emerald-900' : 'text-amber-900'}`}>
              {formData.dataPrivacyConsent ? (
                <>
                  Data Privacy Consent has been acknowledged in the <span className="font-semibold">Before You Continue</span> step.
                </>
              ) : (
                <>
                  Data Privacy Consent is still required. Please return to <span className="font-semibold">Before You Continue</span> and check the consent box before submitting.
                </>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="submissionConfirmed"
                checked={formData.submissionConfirmed}
                onCheckedChange={(checked) => onFieldChange('submissionConfirmed', checked === true)}
                className="mt-1"
              />
              <Label htmlFor="submissionConfirmed" className="text-sm leading-6 font-normal">
                I confirm that all details and attached laboratory results are complete and true. I understand that
                inaccurate information may delay medical clearance.
              </Label>
            </div>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Please review all information carefully before submitting. Once submitted, your medical record will be reviewed by clinic staff.
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
});
