import { memo } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, Loader2, PenLine, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import FilePickerButton from '../../../components/file-picker-button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

import { Textarea } from '../../../components/ui/textarea';
import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  isValidPhilippinePhoneNumber,
  LAB_TEST_SITE_OPTIONS,
  MEDICAL_CONDITIONS,
  YEAR_LEVELS,
} from './constants';
import type { LabUploadKind, MedicalConditionKey, MedicalFormData } from './types';

type Props = {
  step: number;
  formData: MedicalFormData;
  onFieldChange: <K extends keyof MedicalFormData>(field: K, value: MedicalFormData[K]) => void;
  onEmergencyContactChange: (field: 'name' | 'relationship' | 'phone' | 'address', value: string) => void;
  isEmergencyAddressSameAsStudent: boolean;
  onEmergencyAddressSyncChange: (checked: boolean) => void;
  onMedicalConditionChange: (condition: MedicalConditionKey, checked: boolean) => void;
  hasRequiredProfileFields: boolean;
  hasProfilePhoto: boolean;
  hasProfileSignature: boolean;
  profileAssetsLoading: boolean;
  hasCbcFile: boolean;
  hasUrinalysisFile: boolean;
  hasXrayFile: boolean;
  requiresPhysicalCopyAgreement: boolean;
  requiresCbcFile: boolean;
  requiresUrinalysisFile: boolean;
  requiresXrayFile: boolean;
  labResultAccept: string;
  uploadingLabFile: Record<LabUploadKind, boolean>;
  submitBlockers: string[];
  onGoToProfile: () => void;
  onLabFileChange: (kind: LabUploadKind, file: File | null) => void | Promise<void>;
};

export const MedicalFormStepContent = memo(function MedicalFormStepContent({
  step,
  formData,
  onFieldChange,
  onEmergencyContactChange,
  isEmergencyAddressSameAsStudent,
  onEmergencyAddressSyncChange,
  onMedicalConditionChange,
  hasRequiredProfileFields,
  hasProfilePhoto,
  hasProfileSignature,
  profileAssetsLoading,
  hasCbcFile,
  hasUrinalysisFile,
  hasXrayFile,
  requiresPhysicalCopyAgreement,
  requiresCbcFile,
  requiresUrinalysisFile,
  requiresXrayFile,
  labResultAccept,
  uploadingLabFile,
  submitBlockers,
  onGoToProfile,
  onLabFileChange,
}: Props) {
  const stepOneReady = hasRequiredProfileFields && hasProfilePhoto && hasProfileSignature;
  const stepFourReady = (!requiresCbcFile || hasCbcFile) && (!requiresUrinalysisFile || hasUrinalysisFile) && (!requiresXrayFile || hasXrayFile);
  const stepThreeMissingRequired = [
    !formData.hadOperation,
    !formData.emergencyContact.name?.trim(),
    !formData.emergencyContact.relationship?.trim(),
    !formData.emergencyContact.phone?.trim(),
    formData.emergencyContact.phone ? !isValidPhilippinePhoneNumber(formData.emergencyContact.phone) : false,
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
  const shouldShowCbcUpload = Boolean(formData.cbcTestSite.trim() && (formData.cbcTestSite !== 'Others' || formData.cbcTestSiteOther.trim()));
  const shouldShowUrinalysisUpload = Boolean(
    formData.urinalysisTestSite.trim() && (formData.urinalysisTestSite !== 'Others' || formData.urinalysisTestSiteOther.trim()),
  );
  const shouldShowXrayUpload = Boolean(formData.xrayTestSite.trim() && (formData.xrayTestSite !== 'Others' || formData.xrayTestSiteOther.trim()));
  const getProfileAssetStatusLabel = (isReady: boolean) => (isReady ? 'Ready' : profileAssetsLoading ? 'Loadding' : 'Missing');
  const getProfileAssetStatusClass = (isReady: boolean) => (isReady ? 'text-green-700' : 'text-amber-700');
  const getProfileAssetIconClass = (isReady: boolean) =>
    isReady ? 'text-green-600' : profileAssetsLoading ? 'text-amber-600' : 'text-muted-foreground';
  const getLabFileReviewLabel = (
    selectedFile: File | null | undefined,
    existingUrl: string | undefined,
    isUploading = false,
  ) => {
    if (selectedFile && isUploading) {
      return `Uploading replacement: ${selectedFile.name}`;
    }
    if (selectedFile) {
      return existingUrl ? `Replacement selected: ${selectedFile.name}` : selectedFile.name;
    }
    return existingUrl ? 'Submitted file attached' : 'Missing';
  };
  const getLabFileSummary = () => {
    const fileStatuses = [
      requiresCbcFile ? getLabFileReviewLabel(formData.cbcFile, formData.existingCbcFileUrl, uploadingLabFile.cbc) : null,
      requiresUrinalysisFile
        ? getLabFileReviewLabel(formData.urinalysisFile, formData.existingUrinalysisFileUrl, uploadingLabFile.urinalysis)
        : null,
      requiresXrayFile ? getLabFileReviewLabel(formData.xrayFile, formData.existingXrayFileUrl, uploadingLabFile.xray) : null,
    ].filter(Boolean) as string[];

    if (!fileStatuses.length) {
      return 'No uploads required.';
    }

    if (fileStatuses.every((status) => status === 'Submitted file attached')) {
      return 'All required laboratory files are attached.';
    }

    if (fileStatuses.every((status) => status !== 'Missing')) {
      return 'Required laboratory files are ready.';
    }

    return fileStatuses.join(' • ');
  };
  const renderLabUploadField = (
    kind: LabUploadKind,
    title: string,
    selectedFile: File | null | undefined,
    existingUrl: string | undefined,
    isReady: boolean,
  ) => {
    const isUploading = uploadingLabFile[kind];
    const isReplacingSubmittedFile = Boolean(existingUrl && selectedFile);

    return (
      <div
        className={`rounded-lg border p-4 ${
          isUploading || isReplacingSubmittedFile
            ? 'border-amber-300 bg-amber-50/80'
            : isReady
              ? 'border-outline-variant/40 bg-surface-container-low'
              : 'border-red-200 bg-red-50/60'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <FileUp className={`h-4 w-4 ${isReady ? 'text-green-600' : 'text-red-600'}`} />
              <p className="text-sm font-semibold text-on-surface">{title}</p>
            </div>
            {selectedFile && isUploading ? (
              <div
                aria-live="polite"
                className="rounded-md border border-amber-200 bg-amber-100/80 px-3 py-2 text-xs text-amber-950"
              >
                <div className="flex items-start gap-2">
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 break-all">
                      <span className="font-semibold">Uploading replacement:</span>{' '}
                      <span className="break-all">{selectedFile.name}</span>
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-amber-200">
                      <div className="gc-loading-indicator h-full w-1/2 rounded-full bg-amber-500" />
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedFile ? (
              <div className={`rounded-md border px-3 py-2 text-xs ${
                existingUrl ? 'border-amber-200 bg-amber-100/70 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'
              }`}>
                <div className="flex items-start gap-2">
                  {existingUrl ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <p className="min-w-0 break-words">
                    <span className="font-semibold">{existingUrl ? 'Replacement selected' : 'Selected file'}:</span>{' '}
                    <span className="break-all">{selectedFile.name}</span>
                    {existingUrl ? ' will replace the submitted file when you submit.' : ''}
                  </p>
                </div>
              </div>
            ) : existingUrl ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">Submitted file attached.</span>
                  <a href={existingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Open current file
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-700">No file attached yet.</p>
            )}
          </div>
          <div className="min-w-0 space-y-1 sm:w-[18rem]">
            <FilePickerButton
              accept={labResultAccept}
              ariaLabel={`${existingUrl ? 'Choose replacement' : 'Choose'} ${title}`}
              className={`w-full justify-center bg-white ${existingUrl ? 'border-amber-300' : ''}`}
              disabled={isUploading}
              onFileSelected={(nextFile) => {
                void onLabFileChange(kind, nextFile);
              }}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {existingUrl ? 'Choose replacement' : 'Choose file'}
            </FilePickerButton>
          </div>
        </div>
      </div>
    );
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
                <CheckCircle2 className={`h-5 w-5 ${getProfileAssetIconClass(hasProfilePhoto)}`} />
                <span className="text-sm font-medium text-on-surface">1x1 Student Photo</span>
              </div>
              <span className={`text-sm ${getProfileAssetStatusClass(hasProfilePhoto)}`}>
                {getProfileAssetStatusLabel(hasProfilePhoto)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-outline-variant/30 bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <PenLine className={`h-5 w-5 ${getProfileAssetIconClass(hasProfileSignature)}`} />
                <span className="text-sm font-medium text-on-surface">Student Signature</span>
              </div>
              <span className={`text-sm ${getProfileAssetStatusClass(hasProfileSignature)}`}>
                {getProfileAssetStatusLabel(hasProfileSignature)}
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
        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Operations & Emergency Contact</h3>
            <p className="text-sm text-muted-foreground">
              Share your operation history and the person the clinic should contact if an emergency happens.
            </p>
          </div>
          {stepThreeMissingRequired > 0 ? (
            <div className="break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Required fields are missing or invalid. Please complete all fields marked with{' '}
              <span className="font-semibold">*</span>.
            </div>
          ) : null}
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-on-surface">Operation History</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Let the clinic know if you have undergone any operation before.
                </p>
              </div>
              <div>
                <Label>Have you had any operation in the past? *</Label>
                <RadioGroup
                  value={formData.hadOperation}
                  onValueChange={(value) => onFieldChange('hadOperation', value as 'yes' | 'no')}
                  className={`mt-3 grid gap-3 sm:grid-cols-2 ${requiredFieldClass(!formData.hadOperation)}`}
                >
                  <Label
                    htmlFor="op-yes"
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      formData.hadOperation === 'yes'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant/40 bg-white/80 text-on-surface hover:border-primary/40'
                    }`}
                  >
                    <RadioGroupItem value="yes" id="op-yes" />
                    Yes
                  </Label>
                  <Label
                    htmlFor="op-no"
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      formData.hadOperation === 'no'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant/40 bg-white/80 text-on-surface hover:border-primary/40'
                    }`}
                  >
                    <RadioGroupItem value="no" id="op-no" />
                    No
                  </Label>
                </RadioGroup>
              </div>
            </div>
          </div>
          {formData.hadOperation === 'yes' && (
            <div className="rounded-xl border border-outline-variant/40 bg-white/80 p-5">
              <Label htmlFor="operationDetails">Nature of operation and date/year</Label>
              <Textarea
                id="operationDetails"
                value={formData.operationDetails}
                onChange={(event) => onFieldChange('operationDetails', event.target.value)}
                placeholder="Please describe the operation..."
                maxLength={120}
                rows={3}
                className="mt-2 min-h-[96px] resize-none"
              />
            </div>
          )}
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
            <div className="border-b border-outline-variant/30 pb-4">
              <div>
                <h4 className="font-semibold text-on-surface">Emergency Contact Person</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add someone the clinic can contact quickly if urgent care is needed.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ecName">Name *</Label>
                <Input
                  id="ecName"
                  value={formData.emergencyContact.name}
                  onChange={(event) => onEmergencyContactChange('name', event.target.value)}
                  className={requiredFieldClass(!formData.emergencyContact.name?.trim())}
                />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="ecPhone">Cellphone Number *</Label>
                <Input
                  id="ecPhone"
                  value={formData.emergencyContact.phone}
                  onChange={(event) => onEmergencyContactChange('phone', event.target.value)}
                  placeholder="09XXXXXXXXX"
                  inputMode="numeric"
                  maxLength={11}
                  className={requiredFieldClass(
                    !formData.emergencyContact.phone?.trim() ||
                      !isValidPhilippinePhoneNumber(formData.emergencyContact.phone),
                  )}
                />
                <p className="text-xs text-muted-foreground">Use exactly 11 digits starting with 09.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="ecAddress">Address *</Label>
                  <Label
                    htmlFor="ecAddressSameAsStudent"
                    className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal text-on-surface"
                  >
                    <Checkbox
                      id="ecAddressSameAsStudent"
                      checked={isEmergencyAddressSameAsStudent}
                      onCheckedChange={(checked) => onEmergencyAddressSyncChange(checked === true)}
                      className="size-4"
                    />
                    Same as student address
                  </Label>
                </div>
                <Input
                  id="ecAddress"
                  value={formData.emergencyContact.address}
                  onChange={(event) => onEmergencyContactChange('address', event.target.value)}
                  disabled={isEmergencyAddressSameAsStudent}
                  placeholder="House number, street, barangay, city"
                  className={`bg-white/90 ${requiredFieldClass(!formData.emergencyContact.address?.trim())}`}
                />
                <p className="text-xs text-muted-foreground">
                  {isEmergencyAddressSameAsStudent ? 'Synced from your profile address' : 'Keep this brief but complete'}
                </p>
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
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm leading-6 text-on-surface-variant">
                Upload the laboratory result files here. Attachments are kept in private storage and opened through signed access for authorized clinic staff only.
              </p>
            </div>
          </div>
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
              {shouldShowCbcUpload && requiresCbcFile ? (
                <div className="mt-3">
                  {renderLabUploadField('cbc', 'CBC Laboratory Result *', formData.cbcFile || null, formData.existingCbcFileUrl, hasCbcFile)}
                </div>
              ) : null}
              {shouldShowCbcUpload && !requiresCbcFile ? (
                <p className="mt-3 text-xs text-green-700">No upload required. Results from James L. Gordon Memorial Hospital are sent directly to the clinic.</p>
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
              {shouldShowUrinalysisUpload && requiresUrinalysisFile ? (
                <div className="mt-3">
                  {renderLabUploadField(
                    'urinalysis',
                    'Urinalysis Laboratory Result *',
                    formData.urinalysisFile || null,
                    formData.existingUrinalysisFileUrl,
                    hasUrinalysisFile,
                  )}
                </div>
              ) : null}
              {shouldShowUrinalysisUpload && !requiresUrinalysisFile ? (
                <p className="mt-3 text-xs text-green-700">No upload required. Results from James L. Gordon Memorial Hospital are sent directly to the clinic.</p>
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
              {shouldShowXrayUpload && requiresXrayFile ? (
                <div className="mt-3">
                  {renderLabUploadField('xray', 'X-Ray Laboratory Result *', formData.xrayFile || null, formData.existingXrayFileUrl, hasXrayFile)}
                </div>
              ) : null}
              {shouldShowXrayUpload && !requiresXrayFile ? (
                <p className="mt-3 text-xs text-green-700">No upload required. Results from James L. Gordon Memorial Hospital are sent directly to the clinic.</p>
              ) : null}
            </div>
          </div>
          {requiresPhysicalCopyAgreement ? (
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
          ) : (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Physical-copy confirmation is not needed when your CBC, Urinalysis, and X-ray were all done at James L. Gordon Memorial Hospital.
            </div>
          )}
          {!stepFourReady ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Upload the laboratory result files for tests not performed at James L. Gordon Memorial Hospital before moving to the final review step.
            </div>
          ) : null}
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
                  {formData.age} / {formData.sex === 'female' ? 'F' : formData.sex === 'male' ? 'M' : '--'}
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
                <p className="text-muted-foreground">Laboratory files:</p>
                <p className="font-medium">{getLabFileSummary()}</p>
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
                inaccurate information may delay medical certificate issuance.
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
