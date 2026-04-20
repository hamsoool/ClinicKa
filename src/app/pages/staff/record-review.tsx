import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { ArrowLeft, Save, CheckCircle, XCircle, Camera, FileText, ExternalLink, Expand } from 'lucide-react';
import { toast } from 'sonner';
import { getSubmission, updateMeasurements, updateSubmissionStatus } from '../../lib/api';

export default function StaffRecordReview() {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [staffNotes, setStaffNotes] = useState('');
  const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);
  const [measurements, setMeasurements] = useState({
    bloodPressure: '',
    cardiacRate: '',
    respiratoryRate: '',
    temperature: '',
    weight: '',
    height: '',
    bmi: '',
    // Lab results
    xrayDate: '',
    xrayResult: 'normal',
    xrayFindings: '',
    hemoglobin: '',
    hematocrit: '',
    wbc: '',
    plateletCount: '',
    bloodType: '',
    glucose: '',
    protein: '',
    urinalysisGlucose: '',
    urinalysisProtein: '',
  });

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    if (!submissionId) return;
    
    setLoading(true);
    try {
      const data = await getSubmission(submissionId);
      const loadedSubmission = data.submission;
      if (!loadedSubmission) {
        setSubmission(null);
        return;
      }
      setSubmission(loadedSubmission);
      setStaffNotes(loadedSubmission.staffNotes || '');
      
      // Pre-fill measurements if they exist
      if (loadedSubmission.staffMeasurements || loadedSubmission.labResults) {
        setMeasurements(prev => ({
          ...prev,
          ...loadedSubmission.staffMeasurements,
          ...loadedSubmission.labResults,
        }));
      } else {
        // Pre-fill with student's submitted data
        setMeasurements(prev => ({
          ...prev,
          bloodPressure: loadedSubmission.bloodPressure || '',
          weight: loadedSubmission.weight || '',
          height: loadedSubmission.height || '',
          bmi: loadedSubmission.bmi || '',
        }));
      }
    } catch (error) {
      console.error('Error loading submission:', error);
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!submissionId) return;
    
    try {
      await updateSubmissionStatus(submissionId, newStatus, staffNotes);
      setSubmission(prev => prev ? ({
        ...prev,
        status: newStatus,
        staffNotes,
        updatedAt: new Date().toISOString(),
      }) : prev);
      toast.success(`Submission ${newStatus}`);
      navigate('/staff/submissions');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSaveMeasurements = async () => {
    if (!submissionId) return;
    
    try {
      await updateMeasurements(submissionId, measurements);
      setSubmission(prev => prev ? ({
        ...prev,
        staffMeasurements: {
          bloodPressure: measurements.bloodPressure,
          cardiacRate: measurements.cardiacRate,
          respiratoryRate: measurements.respiratoryRate,
          temperature: measurements.temperature,
          weight: measurements.weight,
          height: measurements.height,
          bmi: measurements.bmi,
        },
        labResults: {
          xrayDate: measurements.xrayDate,
          xrayResult: measurements.xrayResult,
          xrayFindings: measurements.xrayFindings,
          hemoglobin: measurements.hemoglobin,
          hematocrit: measurements.hematocrit,
          wbc: measurements.wbc,
          plateletCount: measurements.plateletCount,
          bloodType: measurements.bloodType,
          urinalysisGlucose: measurements.urinalysisGlucose,
          urinalysisProtein: measurements.urinalysisProtein,
        },
      }) : prev);
      toast.success('Measurements saved');
    } catch (error) {
      console.error('Error saving measurements:', error);
      toast.error('Failed to save measurements');
    }
  };

  const updateMeasurement = (field: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [field]: value }));
  };

  const getFilePreviewType = (fileUrl: string) => {
    const normalizedUrl = fileUrl.split('?')[0].toLowerCase();

    if (normalizedUrl.endsWith('.pdf')) return 'pdf';
    if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(normalizedUrl)) return 'image';

    return 'other';
  };

  const renderSubmittedFilePreview = (title: string, fileUrl?: string, alt?: string) => {
    if (!fileUrl) {
      return (
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/50 p-4 text-muted-foreground">
          <FileText className="h-6 w-6" />
          <span className="text-sm">No {title} file uploaded by student</span>
        </div>
      );
    }

    const previewType = getFilePreviewType(fileUrl);
    const previewTitle = `${title} preview`;
    const previewAlt = alt || title;

    const previewContent = (() => {
      switch (previewType) {
        case 'pdf':
          return (
            <iframe
              src={fileUrl}
              title={previewTitle}
              className="h-[420px] w-full bg-white"
            />
          );
        case 'image':
          return (
            <img
              src={fileUrl}
              alt={previewAlt}
              className="max-h-[420px] w-full object-contain bg-black/5"
            />
          );
        default:
          return (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
              <FileText className="h-10 w-10 text-primary" />
              <div>
                <p className="font-medium">{title} file uploaded</p>
                <p className="text-sm text-muted-foreground">Preview is not available for this file type.</p>
              </div>
            </div>
          );
      }
    })();

    return (
      <div className="mb-4 overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title} submitted file</p>
            <p className="text-xs text-muted-foreground">
              {previewType === 'pdf' ? 'PDF preview' : previewType === 'image' ? 'Image preview' : 'File attachment'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Expand className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
                <DialogHeader className="border-b px-6 py-4">
                  <DialogTitle>{title} Submitted File</DialogTitle>
                </DialogHeader>
                <div className="max-h-[calc(90vh-80px)] overflow-auto bg-muted/20 p-4">
                  {previewType === 'pdf' ? (
                    <iframe
                      src={fileUrl}
                      title={`${previewTitle} enlarged`}
                      className="h-[75vh] w-full rounded-md bg-white"
                    />
                  ) : previewType === 'image' ? (
                    <img
                      src={fileUrl}
                      alt={previewAlt}
                      className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center">
                      <p className="text-sm text-muted-foreground">This file type can be opened in a new tab.</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button asChild variant="ghost" size="sm">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </a>
            </Button>
          </div>
        </div>
        {previewContent}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading submission...</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Submission not found</p>
        <Button onClick={() => navigate('/staff/submissions')} className="mt-4">
          Back to Submissions
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'returned':
        return <Badge className="bg-red-100 text-red-800">Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div>
      <Button 
        variant="ghost" 
        onClick={() => navigate('/staff/submissions')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Submissions
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">
            Review Medical Record
          </h1>
          <p className="text-muted-foreground">
            {submission.firstName} {submission.lastName} ({submission.studentId})
          </p>
        </div>
        {getStatusBadge(submission.status)}
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="medical">Medical History</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="labs">Lab Results</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Student photo */}
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  {submission.photoUrl || staffPhotoFile ? (
                    <img
                      src={staffPhotoFile ? URL.createObjectURL(staffPhotoFile) : submission.photoUrl}
                      alt="Student"
                      className="w-24 h-24 rounded-xl object-cover border"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground border">
                      {submission.firstName?.[0]}{submission.lastName?.[0]}
                    </div>
                  )}
                  <div className="mt-2">
                    <Label htmlFor="staffPhoto" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground">
                      <Camera className="w-3 h-3" /> {staffPhotoFile || submission.photoUrl ? 'Replace' : 'Add'} Photo <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="staffPhoto"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload or replace student review photo"
                      onChange={(e) => setStaffPhotoFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm flex-1">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="font-medium">{submission.firstName} {submission.middleInitial} {submission.lastName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Student ID</p>
                    <p className="font-medium">{submission.studentId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Department</p>
                    <p className="font-medium">{submission.department || submission.course}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Year Level</p>
                    <p className="font-medium">Year {submission.year}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Age</p>
                    <p className="font-medium">{submission.age}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sex</p>
                    <p className="font-medium capitalize">{submission.sex}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Birthday</p>
                    <p className="font-medium">{submission.birthday}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Civil Status</p>
                    <p className="font-medium">{submission.civilStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact Number</p>
                    <p className="font-medium">{submission.contactNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{submission.address || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3">Emergency Contact</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{submission.emergencyContact?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Relationship</p>
                    <p className="font-medium">{submission.emergencyContact?.relationship || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{submission.emergencyContact?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{submission.emergencyContact?.address || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical">
          <Card>
            <CardHeader>
              <CardTitle>Medical History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">Reported Conditions</h4>
                  {Object.entries(submission.medicalHistory || {}).filter(([_, v]) => v).length > 0 ? (
                    <ul className="list-disc list-inside space-y-2">
                      {Object.entries(submission.medicalHistory || {})
                        .filter(([_, checked]) => checked)
                        .map(([key, _]) => (
                          <li key={key} className="capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No medical conditions reported</p>
                  )}
                </div>

                {submission.allergyDetails && (
                  <div>
                    <h4 className="font-semibold mb-2">Allergy Details</h4>
                    <p className="text-sm bg-muted p-3 rounded">{submission.allergyDetails}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">Operations</h4>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Had operation: </span>
                    <span className="font-medium">{submission.hadOperation === 'yes' ? 'Yes' : 'No'}</span>
                  </p>
                  {submission.operationDetails && (
                    <p className="text-sm bg-muted p-3 rounded mt-2">{submission.operationDetails}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="measurements">
          <Card>
            <CardHeader>
              <CardTitle>Physical Measurements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Student Reported</h4>
                  <div className="grid md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Blood Pressure</p>
                      <p className="font-medium">{submission.bloodPressure}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Weight</p>
                      <p className="font-medium">{submission.weight} kg</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Height</p>
                      <p className="font-medium">{submission.height} cm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">BMI</p>
                      <p className="font-medium">{submission.bmi}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4">Staff Verified Measurements</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="staffBP">Blood Pressure</Label>
                      <Input
                        id="staffBP"
                        value={measurements.bloodPressure}
                        onChange={(e) => updateMeasurement('bloodPressure', e.target.value)}
                        placeholder="e.g., 120/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardiacRate">Cardiac Rate (bpm)</Label>
                      <Input
                        id="cardiacRate"
                        type="number"
                        value={measurements.cardiacRate}
                        onChange={(e) => updateMeasurement('cardiacRate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="respiratoryRate">Respiratory Rate (per min)</Label>
                      <Input
                        id="respiratoryRate"
                        type="number"
                        value={measurements.respiratoryRate}
                        onChange={(e) => updateMeasurement('respiratoryRate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="temperature">Temperature (°C)</Label>
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        value={measurements.temperature}
                        onChange={(e) => updateMeasurement('temperature', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="staffWeight">Weight (kg)</Label>
                      <Input
                        id="staffWeight"
                        type="number"
                        step="0.1"
                        value={measurements.weight}
                        onChange={(e) => updateMeasurement('weight', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="staffHeight">Height (cm)</Label>
                      <Input
                        id="staffHeight"
                        type="number"
                        step="0.1"
                        value={measurements.height}
                        onChange={(e) => updateMeasurement('height', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="staffBMI">BMI</Label>
                      <Input
                        id="staffBMI"
                        value={measurements.bmi}
                        onChange={(e) => updateMeasurement('bmi', e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveMeasurements} className="mt-4">
                    <Save className="w-4 h-4 mr-2" />
                    Save Measurements
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs">
          <div className="space-y-4">
            {/* Chest X-Ray */}
            <Card>
              <CardHeader>
                <CardTitle>Chest X-Ray</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSubmittedFilePreview('Chest X-Ray', submission.xrayFileUrl, 'Chest X-Ray')}
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="xrayDate">Date</Label>
                      <Input
                        id="xrayDate"
                        type="date"
                        value={measurements.xrayDate}
                        onChange={(e) => updateMeasurement('xrayDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="xrayResult">Result</Label>
                      <select
                        id="xrayResult"
                        value={measurements.xrayResult}
                        onChange={(e) => updateMeasurement('xrayResult', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="normal">Normal</option>
                        <option value="abnormal">Abnormal</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="xrayFindings">Findings</Label>
                    <Textarea
                      id="xrayFindings"
                      value={measurements.xrayFindings}
                      onChange={(e) => updateMeasurement('xrayFindings', e.target.value)}
                      placeholder="Enter X-Ray findings..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CBC */}
            <Card>
              <CardHeader>
                <CardTitle>Complete Blood Count (CBC)</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSubmittedFilePreview('CBC', submission.cbcFileUrl, 'CBC')}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hemoglobin">Hemoglobin</Label>
                    <Input id="hemoglobin" value={measurements.hemoglobin} onChange={(e) => updateMeasurement('hemoglobin', e.target.value)} placeholder="e.g., 14.5 g/dL" />
                  </div>
                  <div>
                    <Label htmlFor="hematocrit">Hematocrit</Label>
                    <Input id="hematocrit" value={measurements.hematocrit} onChange={(e) => updateMeasurement('hematocrit', e.target.value)} placeholder="e.g., 42%" />
                  </div>
                  <div>
                    <Label htmlFor="wbc">White Blood Cell Count</Label>
                    <Input id="wbc" value={measurements.wbc} onChange={(e) => updateMeasurement('wbc', e.target.value)} placeholder="e.g., 7000/μL" />
                  </div>
                  <div>
                    <Label htmlFor="plateletCount">Platelet Count</Label>
                    <Input id="plateletCount" value={measurements.plateletCount} onChange={(e) => updateMeasurement('plateletCount', e.target.value)} placeholder="e.g., 250,000/μL" />
                  </div>
                  <div>
                    <Label htmlFor="bloodType">Blood Type</Label>
                    <Input id="bloodType" value={measurements.bloodType} onChange={(e) => updateMeasurement('bloodType', e.target.value)} placeholder="e.g., O+" />
                  </div>
                  <div>
                    <Label htmlFor="glucose">Glucose</Label>
                    <Input id="glucose" value={measurements.glucose} onChange={(e) => updateMeasurement('glucose', e.target.value)} placeholder="e.g., 90 mg/dL" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Urinalysis */}
            <Card>
              <CardHeader>
                <CardTitle>Urinalysis</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSubmittedFilePreview('Urinalysis', submission.urinalysisFileUrl, 'Urinalysis')}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="urinalysisGlucose">Glucose</Label>
                    <Input id="urinalysisGlucose" value={measurements.urinalysisGlucose} onChange={(e) => updateMeasurement('urinalysisGlucose', e.target.value)} placeholder="e.g., Negative" />
                  </div>
                  <div>
                    <Label htmlFor="urinalysisProtein">Protein</Label>
                    <Input id="urinalysisProtein" value={measurements.urinalysisProtein} onChange={(e) => updateMeasurement('urinalysisProtein', e.target.value)} placeholder="e.g., Negative" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveMeasurements}>
              <Save className="w-4 h-4 mr-2" />
              Save Laboratory Results
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Review Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="staffNotes">Staff Notes / Feedback</Label>
                <Textarea
                  id="staffNotes"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="Add notes or feedback for the student..."
                  rows={6}
                  className="mt-2"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-4">Update Submission Status</h4>
                <div className="flex gap-4">
                  <Button
                    onClick={() => handleStatusUpdate('approved')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Medical Clearance
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate('returned')}
                    variant="destructive"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Return for Correction
                  </Button>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg text-sm">
                <p className="font-medium mb-2">Submission Information</p>
                <p className="text-muted-foreground">
                  Submitted on: {new Date(submission.submittedAt).toLocaleDateString()} at {new Date(submission.submittedAt).toLocaleTimeString()}
                </p>
                {submission.updatedAt && (
                  <p className="text-muted-foreground">
                    Last updated: {new Date(submission.updatedAt).toLocaleDateString()} at {new Date(submission.updatedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
