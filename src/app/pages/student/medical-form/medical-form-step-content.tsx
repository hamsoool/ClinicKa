import { memo, useState } from 'react';
import { CheckCircle2, Info, PenLine, UserRound, XCircle } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Info content for each medical condition
// ---------------------------------------------------------------------------
const MEDICAL_CONDITION_INFO: Record<
  MedicalConditionKey,
  { tag: string; desc: string; note: string }
> = {
  allergy: {
    tag: 'Immune',
    desc: 'An allergy is an immune system reaction to a substance (allergen) that is harmless to most people — such as pollen, pet dander, food, or medication.',
    note: 'If you check this, a text field will appear so you can describe your allergy type.',
  },
  asthma: {
    tag: 'Respiratory',
    desc: 'A chronic condition causing airway inflammation that leads to recurring episodes of wheezing, breathlessness, chest tightness, and coughing.',
    note: 'Bring any current inhaler prescription to your physical exam.',
  },
  chickenPox: {
    tag: 'Infectious',
    desc: 'A highly contagious viral infection caused by the varicella-zoster virus, characterised by an itchy blister-like rash. Past infection typically confers lifelong immunity.',
    note: 'Check this if you have had chicken pox at any point in your life.',
  },
  diabetes: {
    tag: 'Metabolic',
    desc: 'A group of metabolic diseases characterised by high blood glucose levels resulting from defects in insulin production, insulin action, or both.',
    note: 'Check this if you have been diagnosed with Type 1 or Type 2 diabetes.',
  },
  dysmenorrhea: {
    tag: 'Reproductive',
    desc: 'Painful menstrual periods caused by uterine contractions, sometimes associated with underlying conditions such as endometriosis or fibroids.',
    note: 'Check this if you experience significant pain regularly during your menstrual cycle.',
  },
  epilepsySeizure: {
    tag: 'Neurological',
    desc: 'A neurological disorder involving recurrent, unprovoked seizures caused by abnormal electrical activity in the brain.',
    note: 'Check this if you have a diagnosed seizure disorder, regardless of current medication status.',
  },
  heartDisorder: {
    tag: 'Cardiovascular',
    desc: 'A broad category encompassing conditions affecting the heart\'s structure or function, including arrhythmias, congenital defects, or valve problems.',
    note: 'A cardiology clearance letter may be required by the clinic during your physical exam.',
  },
  hepatitis: {
    tag: 'Hepatic',
    desc: 'Inflammation of the liver, most commonly caused by a viral infection (hepatitis A, B, or C). Can also result from alcohol use, toxins, or autoimmune conditions.',
    note: 'Check this if you have ever been diagnosed with any form of hepatitis.',
  },
  hypertension: {
    tag: 'Cardiovascular',
    desc: 'Persistently elevated blood pressure (≥130/80 mmHg) that, if unmanaged, increases the risk of heart disease, stroke, and kidney damage.',
    note: 'Check this if you have a diagnosed hypertension condition, whether or not you are on medication.',
  },
  measles: {
    tag: 'Infectious',
    desc: 'A highly contagious viral disease causing fever, cough, runny nose, inflamed eyes, and a characteristic red skin rash.',
    note: 'Check this if you have been diagnosed with measles at any point in your life.',
  },
  mumps: {
    tag: 'Infectious',
    desc: 'A viral infection that affects the salivary glands, causing painful swelling below the ears or jaw. Spread through saliva and respiratory droplets.',
    note: 'Check this if you have had a confirmed mumps infection.',
  },
  anxietyDisorder: {
    tag: 'Mental Health',
    desc: 'A group of mental health conditions characterised by persistent, excessive worry or fear that interferes with daily activities.',
    note: 'Check this if you have received a formal diagnosis of an anxiety disorder from a healthcare provider.',
  },
  panicAttack: {
    tag: 'Mental Health',
    desc: 'Sudden intense episodes of fear or discomfort accompanied by physical symptoms such as rapid heart rate, shortness of breath, and dizziness.',
    note: 'Check this if you have experienced recurring panic attacks or hyperventilation episodes.',
  },
  pneumonia: {
    tag: 'Respiratory',
    desc: 'An infection that inflames the air sacs in one or both lungs, which may fill with fluid. Caused by bacteria, viruses, or fungi.',
    note: 'Check this if you have had a diagnosed pneumonia infection, past or recurring.',
  },
  ptbPrimaryComplex: {
    tag: 'Respiratory',
    desc: 'Pulmonary tuberculosis or primary complex is a lung infection caused by Mycobacterium tuberculosis. Primary complex refers to the initial form commonly seen in children.',
    note: 'Check this if you have ever been diagnosed with PTB or primary complex, even if already treated.',
  },
  typhoidFever: {
    tag: 'Infectious',
    desc: 'A bacterial infection caused by Salmonella typhi, spread through contaminated food and water, causing high fever, stomach pain, and weakness.',
    note: 'Check this if you have had a confirmed typhoid fever diagnosis.',
  },
  covid19: {
    tag: 'Infectious',
    desc: 'A respiratory illness caused by SARS-CoV-2. Ranges from mild symptoms to severe pneumonia. Long COVID may involve persistent fatigue and other complications.',
    note: 'Check this if you have had a confirmed COVID-19 infection.',
  },
  uti: {
    tag: 'Urological',
    desc: 'A bacterial infection in any part of the urinary system — kidneys, ureters, bladder, or urethra. More common in females.',
    note: 'Check this if you have been diagnosed with a UTI, particularly if it is a recurring condition.',
  },
  others: {
    tag: 'Other',
    desc: 'Any medical condition not listed above. Use this option to disclose other diagnosed health concerns relevant to your medical clearance.',
    note: 'If you check this, a text field will appear so you can type the condition name (up to 20 characters).',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Info tooltip popover
// ---------------------------------------------------------------------------
function ConditionInfoButton({ conditionKey }: { conditionKey: MedicalConditionKey }) {
  const [open, setOpen] = useState(false);
  const info = MEDICAL_CONDITION_INFO[conditionKey];
  const label = MEDICAL_CONDITIONS.find((c) => c.key === conditionKey)?.label ?? conditionKey;

  return (
    <>
      <button
        type="button"
        aria-label={`Learn about ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="
          ml-auto flex-shrink-0
          flex h-5 w-5 items-center justify-center rounded-full
          border border-border/60 bg-transparent
          text-[10px] font-medium text-muted-foreground
          transition-colors duration-150
          hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
        "
      >
        <Info className="h-3 w-3" />
      </button>

      {open && (
        /* Backdrop */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Information about ${label}`}
        >
          {/* Card — stop propagation so clicking inside doesn't close */}
          <div
            className="
              w-full max-w-sm rounded-xl border border-border/60 bg-white p-5 shadow-lg
              animate-in fade-in zoom-in-95 duration-150
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-semibold text-on-surface">{label}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                {info.tag}
              </span>
            </div>

            {/* Description */}
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{info.desc}</p>

            {/* Note */}
            <div className="rounded-lg border border-border/40 bg-surface-container-low px-3 py-2 text-xs text-muted-foreground">
              {info.note}
            </div>

            {/* Close */}
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-border/60 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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

  const relationshipOptions =
    formData.emergencyContact.relationship &&
    !EMERGENCY_CONTACT_RELATIONSHIPS.includes(
      formData.emergencyContact.relationship as (typeof EMERGENCY_CONTACT_RELATIONSHIPS)[number],
    )
      ? [formData.emergencyContact.relationship, ...EMERGENCY_CONTACT_RELATIONSHIPS]
      : EMERGENCY_CONTACT_RELATIONSHIPS;

  switch (step) {
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    case 2:
      return (
        <div className="space-y-4">
          <h3 className="mb-2 text-xl font-semibold">Medical History</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Place a check on conditions that apply to you. Tap the{' '}
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/60 text-[10px] text-muted-foreground align-middle">
              i
            </span>{' '}
            icon on any condition to learn more about it.
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {MEDICAL_CONDITIONS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                {/* Condition row */}
                <div
                  className={`
                    group flex items-center gap-2 rounded-lg border px-3 py-2.5
                    transition-all duration-150 cursor-pointer select-none
                    ${
                      formData.medicalHistory[key]
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-border/50 bg-white hover:border-border hover:bg-surface-container-low'
                    }
                  `}
                  onClick={() => onMedicalConditionChange(key, !formData.medicalHistory[key])}
                  role="checkbox"
                  aria-checked={formData.medicalHistory[key]}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      onMedicalConditionChange(key, !formData.medicalHistory[key]);
                    }
                  }}
                >
                  <Checkbox
                    id={key}
                    checked={formData.medicalHistory[key]}
                    onCheckedChange={(checked) => onMedicalConditionChange(key, checked === true)}
                    className={`
                      mt-0.5 size-4 flex-shrink-0 pointer-events-none
                      transition-all duration-150
                      ${formData.medicalHistory[key] ? 'border-emerald-600 bg-emerald-600' : ''}
                    `}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label
                    htmlFor={key}
                    className={`
                      flex-1 text-sm font-normal cursor-pointer
                      transition-colors duration-150
                      ${formData.medicalHistory[key] ? 'font-medium text-emerald-800' : 'text-on-surface'}
                    `}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {label}
                  </Label>
                  <ConditionInfoButton conditionKey={key} />
                </div>

                {/* Others inline input */}
                {key === 'others' && formData.medicalHistory.others ? (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    <Input
                      id="otherMedicalHistory"
                      value={formData.otherMedicalHistory}
                      onChange={(event) => onFieldChange('otherMedicalHistory', event.target.value)}
                      placeholder="Please specify"
                      maxLength={20}
                      aria-required="true"
                      className={`h-8 text-sm ${
                        !formData.otherMedicalHistory.trim() ? 'border-red-500 ring-1 ring-red-200' : ''
                      }`}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {formData.medicalHistory.others ? (
            <p className="text-xs text-muted-foreground">
              Others accepts letters and spaces only, maximum of 20 characters.
            </p>
          ) : null}

          {formData.medicalHistory.allergy && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-150">
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

    // -----------------------------------------------------------------------
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
                  <Label htmlFor="op-yes" className="font-normal">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="op-no" />
                  <Label htmlFor="op-no" className="font-normal">No</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          {formData.hadOperation === 'yes' && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-surface-container-low p-4 animate-in fade-in slide-in-from-top-1 duration-150">
              <div>
                <Label htmlFor="operationDetails">Nature of operation <span className="text-muted-foreground font-normal">(brief description)</span></Label>
                <Textarea
                  id="operationDetails"
                  value={formData.operationDetails}
                  onChange={(event) => onFieldChange('operationDetails', event.target.value)}
                  placeholder="e.g. Appendectomy, Fracture repair, Tonsillectomy..."
                  maxLength={120}
                  className="mt-1 resize-none"
                  rows={2}
                />
                <p className="mt-1 text-xs text-muted-foreground">{(formData.operationDetails ?? '').length}/120 characters</p>
              </div>
              <div className="w-48">
                <Label htmlFor="operationYear">Year of operation</Label>
                <Select
                  value={formData.operationYear ?? ''}
                  onValueChange={(value) => onFieldChange('operationYear' as keyof MedicalFormData, value as MedicalFormData[keyof MedicalFormData])}
                >
                  <SelectTrigger id="operationYear" className="mt-1">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 55 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Use a valid Philippine mobile number starting with (+63).
                </p>
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

    // -----------------------------------------------------------------------
    case 4:
      return (
        <div className="space-y-4">
          <h3 className="mb-4 text-xl font-semibold">Laboratory Test Sources</h3>
          <p className="text-sm text-muted-foreground">
            Select where each test was performed. Choose <span className="font-medium">Others</span> to type a custom
            clinic/lab name (max 50 letters and numbers).
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
              <Select
                value={formData.urinalysisTestSite}
                onValueChange={(value) => onFieldChange('urinalysisTestSite', value)}
              >
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
                I agree to bring the physical copies of my CBC, Urinalysis, and X-ray test results during the day of my
                physical examination for verification and encoding by the clinic staff.
              </Label>
            </div>
          </div>
        </div>
      );

    // -----------------------------------------------------------------------
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
              <CardTitle className="text-lg">Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-muted-foreground">Past operation:</p>
                <p className="font-medium capitalize">{formData.hadOperation || '--'}</p>
                {formData.hadOperation === 'yes' && (
                  <>
                    <p className="text-muted-foreground">Nature:</p>
                    <p className="break-words font-medium">{formData.operationDetails?.trim() || '--'}</p>
                    <p className="text-muted-foreground">Year:</p>
                    <p className="font-medium">{(formData as any).operationYear || '--'}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Laboratory Test Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-muted-foreground">CBC:</p>
                <p className="font-medium">
                  {formData.cbcTestSite === 'Others'
                    ? formData.cbcTestSiteOther || 'Others'
                    : formData.cbcTestSite || '--'}
                </p>
                <p className="text-muted-foreground">Urinalysis:</p>
                <p className="font-medium">
                  {formData.urinalysisTestSite === 'Others'
                    ? formData.urinalysisTestSiteOther || 'Others'
                    : formData.urinalysisTestSite || '--'}
                </p>
                <p className="text-muted-foreground">X-Ray:</p>
                <p className="font-medium">
                  {formData.xrayTestSite === 'Others'
                    ? formData.xrayTestSiteOther || 'Others'
                    : formData.xrayTestSite || '--'}
                </p>
              </div>
            </CardContent>
          </Card>
          {!formData.dataPrivacyConsent ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Data Privacy Consent is still required. Please return to{' '}
                <span className="font-semibold">Before You Continue</span> and check the consent box before submitting.
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
              Please review all information carefully before submitting. Once submitted, your medical record will be
              reviewed by clinic staff.
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