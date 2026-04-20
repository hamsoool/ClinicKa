import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, ArrowRight, Upload, Check, Camera, Download, Eye } from 'lucide-react';
import type { MockSubmission } from '../../lib/mock-data';
import MedicalRecordPreview from '../../components/medical-record-preview';
import { toast } from 'sonner';
import { submitMedicalRecord, uploadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const DEPARTMENTS = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAS', 'CED'] as const;
const YEAR_LEVELS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
] as const;

const MEDICAL_CONDITIONS = [
  { key: 'allergy', label: 'Allergy' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'chickenPox', label: 'Chicken Pox' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'dysmenorrhea', label: 'Dysmenorrhea' },
  { key: 'epilepsySeizure', label: 'Epilepsy/Seizure' },
  { key: 'heartDisorder', label: 'Heart Disorder' },
  { key: 'hepatitis', label: 'Hepatitis' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'measles', label: 'Measles' },
  { key: 'mumps', label: 'Mumps' },
  { key: 'anxietyDisorder', label: 'Anxiety Disorder' },
  { key: 'panicAttack', label: 'Panic Attack/Hyperventilation' },
  { key: 'pneumonia', label: 'Pneumonia' },
  { key: 'ptbPrimaryComplex', label: 'PTB/Primary Complex' },
  { key: 'typhoidFever', label: 'Typhoid Fever' },
  { key: 'covid19', label: 'COVID-19' },
  { key: 'uti', label: 'Urinary Tract Infection' },
] as const;

export default function StudentMedicalForm() {
  const navigate = useNavigate();
  const { year } = useParams();
  const { me } = useAuth();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const totalSteps = 6;
  const student = me?.student;

  const defaultMedicalHistory = {
    allergy: false,
    asthma: false,
    chickenPox: false,
    diabetes: false,
    dysmenorrhea: false,
    epilepsySeizure: false,
    heartDisorder: false,
    hepatitis: false,
    hypertension: false,
    measles: false,
    mumps: false,
    anxietyDisorder: false,
    panicAttack: false,
    pneumonia: false,
    ptbPrimaryComplex: false,
    typhoidFever: false,
    covid19: false,
    uti: false,
  };

  // Form data
  const [formData, setFormData] = useState({
    // Personal Information
    studentId: student?.student_id || me?.profile.student_id || '',
    firstName: student?.first_name || me?.profile.first_name || '',
    lastName: student?.last_name || me?.profile.last_name || '',
    middleInitial: student?.middle_initial || '',
    department: student?.department || me?.profile.department || 'CCS',
    course: student?.course || me?.profile.course || '',
    yearLevel: year || '1',
    age: student?.age ? String(student.age) : '',
    sex: student?.sex || 'female',
    birthday: student?.birthday || '',
    civilStatus: student?.civil_status || 'Single',
    contactNumber: student?.contact_number || '',
    address: student?.address || '',
    
    // Medical History
    medicalHistory: defaultMedicalHistory,
    allergyDetails: '',
    
    // Operations and Emergency Contact
    hadOperation: 'no',
    operationDetails: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      address: '',
    },
    dataPrivacyConsent: true,
    signatureFile: null as File | null,
    photoFile: null as File | null,
    
    // Physical Measurements
    bloodPressure: '',
    weight: '',
    height: '',
    bmi: '',
    
    // Laboratory Files
    xrayFile: null as File | null,
    cbcFile: null as File | null,
    urinalysisFile: null as File | null,
    
    year: year || '1',
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      studentId: student?.student_id || me?.profile.student_id || prev.studentId,
      firstName: student?.first_name || me?.profile.first_name || prev.firstName,
      lastName: student?.last_name || me?.profile.last_name || prev.lastName,
      middleInitial: student?.middle_initial || prev.middleInitial,
      department: student?.department || me?.profile.department || prev.department,
      course: student?.course || me?.profile.course || prev.course,
      age: student?.age ? String(student.age) : prev.age,
      sex: student?.sex || prev.sex,
      birthday: student?.birthday || prev.birthday,
      civilStatus: student?.civil_status || prev.civilStatus,
      contactNumber: student?.contact_number || prev.contactNumber,
      address: student?.address || prev.address,
      yearLevel: year || prev.yearLevel,
      year: year || prev.year,
    }));
  }, [me?.profile.course, me?.profile.department, me?.profile.first_name, me?.profile.last_name, me?.profile.student_id, student?.address, student?.age, student?.birthday, student?.contact_number, student?.course, student?.department, student?.first_name, student?.last_name, student?.middle_initial, student?.sex, student?.student_id, student?.civil_status, year]);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateBMI = () => {
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height) / 100; // convert cm to m
    if (weight > 0 && height > 0) {
      const bmi = (weight / (height * height)).toFixed(2);
      updateFormData('bmi', bmi);
    }
  };

  const getBMICategory = (bmi: string) => {
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return { category: 'Underweight', color: 'text-blue-600' };
    if (bmiValue < 25) return { category: 'Normal', color: 'text-green-600' };
    if (bmiValue < 30) return { category: 'Overweight', color: 'text-yellow-600' };
    return { category: 'Obese', color: 'text-red-600' };
  };

  const handleFileChange = (field: string, file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }
    updateFormData(field, file);
  };

  // Build a MockSubmission-like object from form data for the preview
  const buildPreviewRecord = (): MockSubmission => ({
    id: 'preview',
    studentId: formData.studentId,
    firstName: formData.firstName,
    lastName: formData.lastName,
    middleInitial: formData.middleInitial,
    course: formData.course,
    department: formData.department,
    year: formData.yearLevel,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    age: formData.age,
    sex: formData.sex,
    birthday: formData.birthday,
    civilStatus: formData.civilStatus,
    contactNumber: formData.contactNumber,
    address: formData.address,
    emergencyContact: formData.emergencyContact,
    medicalHistory: formData.medicalHistory,
    allergyDetails: formData.allergyDetails,
    hadOperation: formData.hadOperation as 'yes' | 'no',
    operationDetails: formData.operationDetails,
    bloodPressure: formData.bloodPressure,
    weight: formData.weight,
    height: formData.height,
    bmi: formData.bmi,
    // Student-reported values placed in staffMeasurements for preview
    staffMeasurements: {
      bloodPressure: formData.bloodPressure,
      weight: formData.weight,
      height: formData.height,
      bmi: formData.bmi,
    },
  });

  const handleSubmit = async () => {
    setUploading(true);
    try {
      const payload = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleInitial: formData.middleInitial,
        department: formData.department,
        course: formData.course,
        yearLevel: formData.yearLevel,
        age: formData.age,
        sex: formData.sex,
        birthday: formData.birthday,
        civilStatus: formData.civilStatus,
        contactNumber: formData.contactNumber,
        address: formData.address,
        medicalHistory: formData.medicalHistory,
        allergyDetails: formData.allergyDetails,
        hadOperation: formData.hadOperation,
        operationDetails: formData.operationDetails,
        emergencyContact: formData.emergencyContact,
        dataPrivacyConsent: formData.dataPrivacyConsent,
        bloodPressure: formData.bloodPressure,
        weight: formData.weight,
        height: formData.height,
        bmi: formData.bmi,
      };

      const { recordId } = await submitMedicalRecord(payload);

      const uploads = [
        formData.photoFile ? uploadFile(formData.photoFile, recordId, 'photo') : null,
        formData.signatureFile ? uploadFile(formData.signatureFile, recordId, 'signature') : null,
        formData.xrayFile ? uploadFile(formData.xrayFile, recordId, 'xray') : null,
        formData.cbcFile ? uploadFile(formData.cbcFile, recordId, 'cbc') : null,
        formData.urinalysisFile ? uploadFile(formData.urinalysisFile, recordId, 'urinalysis') : null,
      ].filter(Boolean) as Promise<any>[];

      await Promise.all(uploads);
      toast.success('Medical record submitted successfully!');
      setSubmitted(true);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('Failed to submit medical record');
    } finally {
      setUploading(false);
    }
  };

  const downloadPDF = () => {
    if (!previewRef.current) return;
    const content = previewRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=816,height=1260');
    if (!printWindow) {
      toast.error('Please allow pop-ups to download');
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Medical Record - ${formData.firstName} ${formData.lastName}</title>
      <style>
        @page { size: 8.5in 13in; margin: 0.5in; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>${content}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
    </body></html>`);
    printWindow.document.close();
    toast.success('Medical record PDF downloading...');
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.firstName && formData.lastName && formData.studentId &&
               formData.department && formData.yearLevel && formData.age && formData.sex && formData.birthday;
      case 2:
        return true; // Medical history is optional
      case 3:
        return formData.hadOperation && formData.emergencyContact.name &&
               formData.emergencyContact.phone && formData.dataPrivacyConsent && formData.photoFile;
      case 4:
        return formData.bloodPressure && formData.weight && formData.height;
      case 5:
        return formData.xrayFile && formData.cbcFile && formData.urinalysisFile;
      case 6:
        return true;
      default:
        return false;
    }
  };

  // =============== SUBMITTED → PREVIEW ===============
  if (submitted) {
    const previewRecord = buildPreviewRecord();
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-1">Medical Record Submitted</h1>
              <p className="text-muted-foreground">
                Your medical record has been submitted and is pending review by the clinic staff.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadPDF} className="bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={() => navigate('/student')}>
                Back to Dashboard
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <CardTitle>Medical Record Form Preview</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                This is how your medical record form looks. It matches the official Gordon College Health Services form format.
              </p>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto bg-white p-4">
                <MedicalRecordPreview ref={previewRef} record={previewRecord} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // =============== FORM STEPS ===============
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Personal Information</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="studentId">Student ID *</Label>
                <Input
                  id="studentId"
                  value={formData.studentId}
                  onChange={(e) => updateFormData('studentId', e.target.value)}
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="department">Department *</Label>
                <Select value={formData.department} onValueChange={(v) => updateFormData('department', v)}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="yearLevel">Year Level *</Label>
                <Select value={formData.yearLevel} onValueChange={(v) => updateFormData('yearLevel', v)}>
                  <SelectTrigger id="yearLevel">
                    <SelectValue placeholder="Select year level" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_LEVELS.map(y => (
                      <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="course">Course / Program *</Label>
                <Input
                  id="course"
                  value={formData.course}
                  onChange={(e) => updateFormData('course', e.target.value)}
                  placeholder="e.g., BS Computer Science"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => updateFormData('lastName', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => updateFormData('firstName', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="middleInitial">M.I.</Label>
                <Input
                  id="middleInitial"
                  value={formData.middleInitial}
                  onChange={(e) => updateFormData('middleInitial', e.target.value)}
                  maxLength={1}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="birthday">Birthday *</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => updateFormData('birthday', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="civilStatus">Civil Status</Label>
                <Select value={formData.civilStatus} onValueChange={(v) => updateFormData('civilStatus', v)}>
                  <SelectTrigger id="civilStatus">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => updateFormData('age', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="sex">Sex *</Label>
                <RadioGroup value={formData.sex} onValueChange={(v) => updateFormData('sex', v)}>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female" className="font-normal">F</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male" className="font-normal">M</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactNumber">Tel./CP #</Label>
                <Input
                  id="contactNumber"
                  value={formData.contactNumber}
                  onChange={(e) => updateFormData('contactNumber', e.target.value)}
                  placeholder="e.g., 09123456789"
                />
              </div>
              <div>
                <Label htmlFor="address">Present Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateFormData('address', e.target.value)}
                  placeholder="Complete address"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-2">Medical History</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Place a CHECK (✓) on conditions that apply to you
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {MEDICAL_CONDITIONS.map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={formData.medicalHistory[key as keyof typeof formData.medicalHistory]}
                    onCheckedChange={(checked) => 
                      updateFormData('medicalHistory', {
                        ...formData.medicalHistory,
                        [key]: checked,
                      })
                    }
                  />
                  <Label htmlFor={key} className="font-normal text-sm">{label}</Label>
                </div>
              ))}
            </div>

            {formData.medicalHistory.allergy && (
              <div className="mt-4">
                <Label htmlFor="allergyDetails">Specify Allergy Type</Label>
                <Textarea
                  id="allergyDetails"
                  value={formData.allergyDetails}
                  onChange={(e) => updateFormData('allergyDetails', e.target.value)}
                  placeholder="Please describe your allergies..."
                />
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Operations & Emergency Contact</h3>
            
            <div>
              <Label>Have you had any operation in the past? *</Label>
              <RadioGroup value={formData.hadOperation} onValueChange={(v) => updateFormData('hadOperation', v)}>
                <div className="flex gap-4 mt-2">
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
              <div>
                <Label htmlFor="operationDetails">Nature of operation and date/year</Label>
                <Textarea
                  id="operationDetails"
                  value={formData.operationDetails}
                  onChange={(e) => updateFormData('operationDetails', e.target.value)}
                  placeholder="Please describe the operation..."
                />
              </div>
            )}

            <div className="border-t pt-4 mt-6">
              <h4 className="font-semibold mb-4">Emergency Contact Person</h4>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ecName">Name *</Label>
                  <Input
                    id="ecName"
                    value={formData.emergencyContact.name}
                    onChange={(e) => updateFormData('emergencyContact', {
                      ...formData.emergencyContact,
                      name: e.target.value
                    })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="ecRelationship">Relationship</Label>
                  <Input
                    id="ecRelationship"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => updateFormData('emergencyContact', {
                      ...formData.emergencyContact,
                      relationship: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="ecPhone">Tel. phone No. CP *</Label>
                  <Input
                    id="ecPhone"
                    value={formData.emergencyContact.phone}
                    onChange={(e) => updateFormData('emergencyContact', {
                      ...formData.emergencyContact,
                      phone: e.target.value
                    })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="ecAddress">Address</Label>
                  <Input
                    id="ecAddress"
                    value={formData.emergencyContact.address}
                    onChange={(e) => updateFormData('emergencyContact', {
                      ...formData.emergencyContact,
                      address: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-6">
              <h4 className="font-semibold mb-4">Data Privacy Waiver</h4>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="privacy"
                  checked={formData.dataPrivacyConsent}
                  onCheckedChange={(checked) => updateFormData('dataPrivacyConsent', checked)}
                />
                <Label htmlFor="privacy" className="font-normal text-sm">
                  *Data Privacy Waiver: I am willing to disclose my personal information with the GC clinic. I have the right to access my personal data 
                  in a timely manner (5 days request). The clinic respects patient's privacy and is accountable to protect my personal information. *
                </Label>
              </div>

              {/* Student Photo – required */}
              <div className="mt-6 border rounded-xl p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-5 h-5 text-primary" />
                  <Label htmlFor="photo" className="text-base font-semibold">1×1 Student Photo *</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Upload a clear, recent 1×1 photo (JPEG or PNG, max 5 MB). This is required to proceed.
                </p>
                <Input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  aria-label="Upload student photo"
                  onChange={(e) => handleFileChange('photoFile', e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {formData.photoFile && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={URL.createObjectURL(formData.photoFile)}
                      alt="Preview"
                      className="w-16 h-16 rounded-lg object-cover border"
                    />
                    <div className="flex items-center text-sm text-green-600">
                      <Check className="w-4 h-4 mr-2" />
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
                  onChange={(e) => handleFileChange('signatureFile', e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload your signature image (PNG, JPG)
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Physical Measurements</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bp">Blood Pressure *</Label>
                <Input
                  id="bp"
                  value={formData.bloodPressure}
                  onChange={(e) => updateFormData('bloodPressure', e.target.value)}
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
                  onChange={(e) => {
                    updateFormData('weight', e.target.value);
                    setTimeout(calculateBMI, 100);
                  }}
                  placeholder="e.g., 65.5"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="height">Height (cm) *</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={formData.height}
                  onChange={(e) => {
                    updateFormData('height', e.target.value);
                    setTimeout(calculateBMI, 100);
                  }}
                  placeholder="e.g., 170"
                />
              </div>
              
              <div>
                <Label htmlFor="bmi">BMI (Auto-calculated)</Label>
                <Input
                  id="bmi"
                  value={formData.bmi}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {formData.bmi && (
              <Card className="bg-primary/5">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Your BMI Category</p>
                    <p className={`text-2xl font-bold ${getBMICategory(formData.bmi).color}`}>
                      {getBMICategory(formData.bmi).category}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      BMI: {formData.bmi}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Laboratory Results Upload</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please upload your laboratory results (PDF, PNG, or JPG format)
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
                    onChange={(e) => handleFileChange('xrayFile', e.target.files?.[0] || null)}
                    className="cursor-pointer mt-2"
                  />
                  {formData.xrayFile && (
                    <div className="mt-2 flex items-center text-sm text-green-600">
                      <Check className="w-4 h-4 mr-2" />
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
                    onChange={(e) => handleFileChange('cbcFile', e.target.files?.[0] || null)}
                    className="cursor-pointer mt-2"
                  />
                  {formData.cbcFile && (
                    <div className="mt-2 flex items-center text-sm text-green-600">
                      <Check className="w-4 h-4 mr-2" />
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
                    onChange={(e) => handleFileChange('urinalysisFile', e.target.files?.[0] || null)}
                    className="cursor-pointer mt-2"
                  />
                  {formData.urinalysisFile && (
                    <div className="mt-2 flex items-center text-sm text-green-600">
                      <Check className="w-4 h-4 mr-2" />
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
            <h3 className="text-xl font-semibold mb-4">Review and Submit</h3>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex gap-4 items-start mb-4">
                  {formData.photoFile && (
                    <img
                      src={URL.createObjectURL(formData.photoFile)}
                      alt="Student photo"
                      className="w-20 h-20 rounded-xl object-cover border"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <p className="text-muted-foreground">Name:</p>
                    <p className="font-medium">{formData.lastName}, {formData.firstName} {formData.middleInitial}</p>

                    <p className="text-muted-foreground">Student ID:</p>
                    <p className="font-medium">{formData.studentId}</p>

                    <p className="text-muted-foreground">Course/Dept:</p>
                    <p className="font-medium">{formData.course} ({formData.department})</p>

                    <p className="text-muted-foreground">Year Level:</p>
                    <p className="font-medium">{YEAR_LEVELS.find(y => y.value === formData.yearLevel)?.label}</p>

                    <p className="text-muted-foreground">Birthday:</p>
                    <p className="font-medium">{formData.birthday}</p>

                    <p className="text-muted-foreground">Age / Sex:</p>
                    <p className="font-medium">{formData.age} / {formData.sex === 'female' ? 'F' : 'M'}</p>

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
                {Object.entries(formData.medicalHistory).filter(([_, v]) => v).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {MEDICAL_CONDITIONS
                      .filter(({ key }) => formData.medicalHistory[key as keyof typeof formData.medicalHistory])
                      .map(({ key, label }) => (
                        <span key={key} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                          ✓ {label}
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
              <CardContent className="text-sm space-y-2">
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
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Chest X-Ray: {formData.xrayFile?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>CBC: {formData.cbcFile?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Urinalysis: {formData.urinalysisFile?.name}</span>
                </div>
                {formData.signatureFile && (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Signature: {formData.signatureFile.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please review all information carefully before submitting. Once submitted, your medical record 
                will be reviewed by clinic staff. After submission, you will see a preview of your form.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/student/year-selection')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Year Selection
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Year {year} Medical Record Form
          </h1>
          <p className="text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>

        <div className="mb-8">
          <Progress value={(step / totalSteps) * 100} className="h-2" />
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderStep()}

            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {step < totalSteps ? (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canProceed()}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || uploading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {uploading ? 'Submitting...' : 'Submit Medical Record'}
                  {!uploading && <Upload className="w-4 h-4 ml-2" />}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
