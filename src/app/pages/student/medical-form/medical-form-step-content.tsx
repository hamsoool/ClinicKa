import { memo } from 'react';
import { Camera, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';
import { Checkbox } from '../../../components/ui/checkbox';
import { Textarea } from '../../../components/ui/textarea';
import { DEPARTMENTS, MEDICAL_CONDITIONS, YEAR_LEVELS } from './constants';
import type { BmiCategory, MedicalConditionKey, MedicalFormData } from './types';

type Props = {
  step: number;
  formData: MedicalFormData;
  onFieldChange: <K extends keyof MedicalFormData>(field: K, value: MedicalFormData[K]) => void;
  onEmergencyContactChange: (field: 'name' | 'relationship' | 'phone' | 'address', value: string) => void;
  onMedicalConditionChange: (condition: MedicalConditionKey, checked: boolean) => void;
  onMeasurementChange: (field: 'bloodPressure' | 'weight' | 'height' | 'bmi', value: string) => void;
  onFileChange: (field: 'photoFile' | 'signatureFile' | 'xrayFile' | 'cbcFile' | 'urinalysisFile', file: File | null) => void;
  getBmiCategory: (bmi: string) => BmiCategory;
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
}: Props) {
  switch (step) {
    case 1:
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight">Personal Information</h3>
            <p className="text-sm text-muted-foreground">
              Fill in your current student and contact details. Fields marked with an asterisk are required before you can proceed.
            </p>
          </div>

          <div className="grid gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-12">
            <div className="xl:col-span-3">
              <Label htmlFor="studentId">Student ID *</Label>
              <Input
                id="studentId"
                value={formData.studentId}
                onChange={(event) => onFieldChange('studentId', event.target.value)}
                placeholder="e.g. 202310417"
              />
            </div>
            <div className="xl:col-span-3">
              <Label htmlFor="department">Department *</Label>
              <Select value={formData.department} onValueChange={(value) => onFieldChange('department', value)}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="xl:col-span-2">
              <Label htmlFor="yearLevel">Year Level *</Label>
              <Select value={formData.yearLevel} onValueChange={(value) => onFieldChange('yearLevel', value)}>
                <SelectTrigger id="yearLevel">
                  <SelectValue placeholder="Select year level" />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_LEVELS.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <Label htmlFor="course">Course / Program *</Label>
              <Input
                id="course"
                value={formData.course}
                onChange={(event) => onFieldChange('course', event.target.value)}
                placeholder="e.g., BS Computer Science"
              />
            </div>
            <div className="xl:col-span-4">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" value={formData.lastName} onChange={(event) => onFieldChange('lastName', event.target.value)} />
            </div>
            <div className="xl:col-span-4">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" value={formData.firstName} onChange={(event) => onFieldChange('firstName', event.target.value)} />
            </div>
            <div className="xl:col-span-1">
              <Label htmlFor="middleInitial">M.I.</Label>
              <Input
                id="middleInitial"
                value={formData.middleInitial}
                onChange={(event) => onFieldChange('middleInitial', event.target.value)}
                maxLength={1}
              />
            </div>
            <div className="xl:col-span-3">
              <Label htmlFor="birthday">Birthday *</Label>
              <Input id="birthday" type="date" value={formData.birthday} onChange={(event) => onFieldChange('birthday', event.target.value)} />
            </div>
            <div className="xl:col-span-3">
              <Label htmlFor="civilStatus">Civil Status</Label>
              <Select value={formData.civilStatus} onValueChange={(value) => onFieldChange('civilStatus', value)}>
                <SelectTrigger id="civilStatus">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married">Married</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="xl:col-span-2">
              <Label htmlFor="age">Age *</Label>
              <Input id="age" type="number" value={formData.age} onChange={(event) => onFieldChange('age', event.target.value)} />
            </div>
            <div className="xl:col-span-3">
              <Label htmlFor="sex">Sex *</Label>
              <RadioGroup value={formData.sex} onValueChange={(value) => onFieldChange('sex', value)} className="pt-3">
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="font-normal">
                      F
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="font-normal">
                      M
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
            <div className="xl:col-span-4">
              <Label htmlFor="contactNumber">Tel./CP #</Label>
              <Input
                id="contactNumber"
                value={formData.contactNumber}
                onChange={(event) => onFieldChange('contactNumber', event.target.value)}
                placeholder="e.g., 09123456789"
              />
            </div>
            <div className="md:col-span-2 xl:col-span-8">
              <Label htmlFor="address">Present Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(event) => onFieldChange('address', event.target.value)}
                placeholder="Complete address"
              />
            </div>
          </div>
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
                <Checkbox id={key} checked={formData.medicalHistory[key]} onCheckedChange={(checked) => onMedicalConditionChange(key, checked === true)} />
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
          <div>
            <Label>Have you had any operation in the past? *</Label>
            <RadioGroup value={formData.hadOperation} onValueChange={(value) => onFieldChange('hadOperation', value as 'yes' | 'no')}>
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
              />
            </div>
          )}
          <div className="mt-6 border-t pt-4">
            <h4 className="mb-4 font-semibold">Emergency Contact Person</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ecName">Name *</Label>
                <Input id="ecName" value={formData.emergencyContact.name} onChange={(event) => onEmergencyContactChange('name', event.target.value)} />
              </div>
              <div>
                <Label htmlFor="ecRelationship">Relationship</Label>
                <Input
                  id="ecRelationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(event) => onEmergencyContactChange('relationship', event.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ecPhone">Tel. phone No. CP *</Label>
                <Input id="ecPhone" value={formData.emergencyContact.phone} onChange={(event) => onEmergencyContactChange('phone', event.target.value)} />
              </div>
              <div>
                <Label htmlFor="ecAddress">Address</Label>
                <Input id="ecAddress" value={formData.emergencyContact.address} onChange={(event) => onEmergencyContactChange('address', event.target.value)} />
              </div>
            </div>
          </div>
          <div className="mt-6 border-t pt-4">
            <h4 className="mb-4 font-semibold">Data Privacy Waiver</h4>
            <div className="flex items-start space-x-2">
              <Checkbox id="privacy" checked={formData.dataPrivacyConsent} onCheckedChange={(checked) => onFieldChange('dataPrivacyConsent', checked === true)} />
              <Label htmlFor="privacy" className="text-sm font-normal">
                *Data Privacy Waiver: I am willing to disclose my personal information with the GC clinic. I have the right to access my personal data
                in a timely manner (5 days request). The clinic respects patient's privacy and is accountable to protect my personal information. *
              </Label>
            </div>
            <div className="mt-6 rounded-xl border bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                <Label htmlFor="photo" className="text-base font-semibold">
                  1x1 Student Photo *
                </Label>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Upload a clear, recent 1x1 photo (JPEG or PNG, max 5 MB). This is required to proceed.</p>
              <Input
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                aria-label="Upload student photo"
                onChange={(event) => onFileChange('photoFile', event.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              {formData.photoFile && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={URL.createObjectURL(formData.photoFile)} alt="Preview" className="h-16 w-16 rounded-lg border object-cover" />
                  <div className="flex items-center text-sm text-green-600">
                    <Check className="mr-2 h-4 w-4" />
                    {formData.photoFile.name}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Label htmlFor="signature">Signature of Student (Upload)</Label>
              <Input
                id="signature"
                type="file"
                accept="image/*"
                aria-label="Upload student signature"
                onChange={(event) => onFileChange('signatureFile', event.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <p className="mt-1 text-xs text-muted-foreground">Upload your signature image (PNG, JPG)</p>
            </div>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="space-y-4">
          <h3 className="mb-4 text-xl font-semibold">Physical Measurements</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="bp">Blood Pressure *</Label>
              <Input
                id="bp"
                value={formData.bloodPressure}
                onChange={(event) => onMeasurementChange('bloodPressure', event.target.value)}
                placeholder="e.g., 120/80"
              />
            </div>
            <div>
              <Label htmlFor="weight">Weight (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(event) => onMeasurementChange('weight', event.target.value)}
                placeholder="e.g., 65.5"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="height">Height (cm) *</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(event) => onMeasurementChange('height', event.target.value)}
                placeholder="e.g., 170"
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
          <p className="mb-4 text-sm text-muted-foreground">Please upload your laboratory results (PDF, PNG, or JPG format)</p>
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
                  className="mt-2 cursor-pointer"
                />
                {formData.xrayFile && (
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <Check className="mr-2 h-4 w-4" />
                    {formData.xrayFile.name}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="cbc">Complete Blood Count (CBC) *</Label>
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
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="urinalysis">Urinalysis (U/A) *</Label>
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
              </CardContent>
            </Card>
          </div>
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
              <div className="mb-4 flex items-start gap-4">
                {formData.photoFile && (
                  <img src={URL.createObjectURL(formData.photoFile)} alt="Student photo" className="h-20 w-20 rounded-xl border object-cover" />
                )}
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Name:</p>
                  <p className="font-medium">
                    {formData.lastName}, {formData.firstName} {formData.middleInitial}
                  </p>
                  <p className="text-muted-foreground">Student ID:</p>
                  <p className="font-medium">{formData.studentId}</p>
                  <p className="text-muted-foreground">Course/Dept:</p>
                  <p className="font-medium">
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
              <div className="grid grid-cols-2 gap-2">
                <p className="text-muted-foreground">Blood Pressure:</p>
                <p className="font-medium">{formData.bloodPressure}</p>
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
                <span>Chest X-Ray: {formData.xrayFile?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>CBC: {formData.cbcFile?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Urinalysis: {formData.urinalysisFile?.name}</span>
              </div>
              {formData.signatureFile && (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Signature: {formData.signatureFile.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
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
