<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Certificate;
use App\Models\EmergencyContact;
use App\Models\FileRecord;
use App\Models\LabCbc;
use App\Models\LabChestXray;
use App\Models\LabUrinalysis;
use App\Models\MedicalHistory;
use App\Models\Profile;
use App\Models\StaffMeasurement;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\StudentNotification;
use App\Models\Submission;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubmissionController extends Controller
{
    /**
     * Helper to format full staff display name.
     */
    protected function formatStaffName(?StaffUser $staff): ?string
    {
        if (! $staff) return null;
        $name = trim("{$staff->first_name} {$staff->last_name}");
        return $name ?: null;
    }

    /**
     * Map a submission model to the exact frontend SubmissionRecord structure.
     */
    protected function mapSubmissionDetail(Submission $sub): array
    {
        $student = $sub->student ?: Student::where('student_id', $sub->student_id)->first();
        $reviewer = $sub->reviewed_by ? StaffUser::where('profile_id', $sub->reviewed_by)->orWhere('id', $sub->reviewed_by)->first() : null;
        $ec = $sub->emergencyContact;
        $mh = $sub->medicalHistory;
        $sm = $sub->staffMeasurements;
        $xray = $sub->chestXray;
        $cbc = $sub->cbc;
        $uri = $sub->urinalysis;
        $cert = $sub->certificate;

        // Files map
        $files = $sub->files()->get();
        $filesByType = [];
        foreach ($files as $f) {
            $filesByType[$f->type] = $f;
        }

        // Fallback for photo & signature from student profile if not directly on submission
        if (! isset($filesByType['photo']) && $student?->profile_id) {
            $profilePhoto = FileRecord::where('uploaded_by', $student->profile_id)->where('type', 'photo')->latest()->first();
            if ($profilePhoto) {
                $filesByType['photo'] = $profilePhoto;
            }
        }
        if (! isset($filesByType['signature']) && $student?->profile_id) {
            $profileSig = FileRecord::where('uploaded_by', $student->profile_id)->where('type', 'signature')->latest()->first();
            if ($profileSig) {
                $filesByType['signature'] = $profileSig;
            }
        }

        return [
            'id' => $sub->id,
            'studentId' => $sub->student_id,
            'firstName' => $sub->first_name ?: ($student->first_name ?? ''),
            'lastName' => $sub->last_name ?: ($student->last_name ?? ''),
            'middleInitial' => $sub->middle_initial ?: ($student->middle_initial ?? ''),
            'course' => $sub->course ?: ($student->course ?? ''),
            'department' => $sub->department ?: ($student->department ?? ''),
            'year' => (string) $sub->year_level,
            'studentYearLevel' => $student && $student->year_level ? (string) $student->year_level : (string) $sub->year_level,
            'academicYear' => $sub->academic_year,
            'status' => $sub->status,
            'submittedAt' => $sub->submitted_at ? $sub->submitted_at->toIso8601String() : null,
            'updatedAt' => $sub->updated_at ? $sub->updated_at->toIso8601String() : null,
            'reviewedByStaffId' => $sub->reviewed_by,
            'reviewedByName' => $this->formatStaffName($reviewer),
            'reviewedByPosition' => $reviewer ? $reviewer->position : null,
            'staffNotes' => $sub->staff_notes,
            'age' => (string) ($sub->age ?: ($student->age ?? '')),
            'sex' => $sub->sex ?: ($student->sex ?? ''),
            'birthday' => $sub->birthday ?: ($student->birthday ?? ''),
            'civilStatus' => $sub->civil_status ?: ($student->civil_status ?? ''),
            'contactNumber' => $sub->contact_number ?: ($student->contact_number ?? ''),
            'address' => $sub->address ?: ($student->address ?? ''),
            'allergyDetails' => $sub->allergy_details,
            'hadOperation' => $sub->had_operation,
            'operationDetails' => $sub->operation_details,
            'bloodPressure' => $sub->blood_pressure,
            'weight' => $sub->weight,
            'height' => $sub->height,
            'bmi' => $sub->bmi,
            'emergencyContact' => $ec ? [
                'name' => $ec->name,
                'relationship' => $ec->relationship,
                'phone' => $ec->phone,
                'address' => $ec->address,
            ] : null,
            'medicalHistory' => $mh ? [
                'allergy' => (bool) $mh->allergy,
                'asthma' => (bool) $mh->asthma,
                'chickenPox' => (bool) $mh->chicken_pox,
                'diabetes' => (bool) $mh->diabetes,
                'dysmenorrhea' => (bool) $mh->dysmenorrhea,
                'epilepsySeizure' => (bool) $mh->epilepsy_seizure,
                'heartDisorder' => (bool) $mh->heart_disorder,
                'hepatitis' => (bool) $mh->hepatitis,
                'hypertension' => (bool) $mh->hypertension,
                'measles' => (bool) $mh->measles,
                'mumps' => (bool) $mh->mumps,
                'anxietyDisorder' => (bool) $mh->anxiety_disorder,
                'panicAttack' => (bool) $mh->panic_attack,
                'pneumonia' => (bool) $mh->pneumonia,
                'ptbPrimaryComplex' => (bool) $mh->ptb_primary_complex,
                'typhoidFever' => (bool) $mh->typhoid_fever,
                'covid19' => (bool) $mh->covid19,
                'uti' => (bool) $mh->uti,
            ] : null,
            'staffMeasurements' => $sm ? [
                'bloodPressure' => $sm->blood_pressure,
                'cardiacRate' => $sm->cardiac_rate,
                'respiratoryRate' => $sm->respiratory_rate,
                'temperature' => $sm->temperature,
                'weight' => $sm->weight,
                'height' => $sm->height,
                'bmi' => $sm->bmi,
                'visualAcuity' => $sm->visual_acuity,
                'skin' => $sm->skin,
                'heent' => $sm->heent,
                'chestLungs' => $sm->chest_lungs,
                'heart' => $sm->heart,
                'abdomen' => $sm->abdomen,
                'extremities' => $sm->extremities,
                'others' => $sm->others,
                'examinedBy' => $sm->examined_by,
                'examinedBySignatureUrl' => $sm->examined_by_signature_url,
            ] : null,
            'labResults' => [
                'xrayDate' => $xray ? $xray->xray_date : null,
                'xrayResult' => $xray ? $xray->xray_result : null,
                'xrayFindings' => $xray ? $xray->xray_findings : null,
                'cbcDate' => $cbc ? $cbc->cbc_date : null,
                'hemoglobin' => $cbc ? $cbc->hemoglobin : null,
                'hematocrit' => $cbc ? $cbc->hematocrit : null,
                'wbc' => $cbc ? $cbc->wbc : null,
                'plateletCount' => $cbc ? $cbc->platelet_count : null,
                'bloodType' => $cbc ? $cbc->blood_type : null,
                'glucose' => $cbc ? $cbc->glucose : null,
                'protein' => $cbc ? $cbc->protein : null,
                'urinalysisDate' => $uri ? $uri->urinalysis_date : null,
                'urinalysisGlucose' => $uri ? $uri->glucose : null,
                'urinalysisProtein' => $uri ? $uri->protein : null,
            ],
            'clearanceInfo' => $cert ? [
                'findingsNormal' => (bool) $cert->findings_normal,
                'diagnosis' => $cert->diagnosis,
                'remarks' => $cert->remarks,
                'purpose' => $cert->purpose,
                'controlNo' => $cert->control_no,
                'issuedDate' => $cert->issued_date ? $cert->issued_date->format('Y-m-d') : null,
                'licenseNo' => $cert->license_no,
                'signatoryName' => $cert->signatory_name,
            ] : null,
            'photoUrl' => $filesByType['photo']->url ?? $student->profile_photo_url ?? null,
            'signatureUrl' => $filesByType['signature']->url ?? $student->signature_url ?? null,
            'xrayFileUrl' => $xray->file_url ?? $filesByType['xray']->url ?? $filesByType['chest_xray']->url ?? null,
            'cbcFileUrl' => $cbc->file_url ?? $filesByType['cbc']->url ?? null,
            'urinalysisFileUrl' => $uri->file_url ?? $filesByType['urinalysis']->url ?? null,
            'certificatePdfUrl' => $cert->pdf_url ?? $filesByType['certificate']->url ?? null,
            'labTestLocation' => $sub->lab_test_location ?: '',
            'otherClinicName' => $sub->lab_test_clinic ?: '',
            'cbcTestClinic' => $sub->cbc_test_clinic ?: '',
            'urinalysisTestClinic' => $sub->urinalysis_test_clinic ?: '',
            'xrayTestClinic' => $sub->xray_test_clinic ?: '',
        ];
    }

    /**
     * Map a submission to a summary record for tables/queues.
     */
    protected function mapSubmissionSummary(Submission $sub, array $reviewers = []): array
    {
        $reviewer = $sub->reviewed_by ? ($reviewers[$sub->reviewed_by] ?? null) : null;
        $student = $sub->relationLoaded('student') ? $sub->student : $sub->student;

        return [
            'id' => $sub->id,
            'studentId' => $sub->student_id,
            'firstName' => $sub->first_name ?: ($student->first_name ?? ''),
            'lastName' => $sub->last_name ?: ($student->last_name ?? ''),
            'middleInitial' => $sub->middle_initial ?: ($student->middle_initial ?? ''),
            'course' => $sub->course ?: ($student->course ?? ''),
            'department' => $sub->department ?: ($student->department ?? ''),
            'year' => (string) $sub->year_level,
            'studentYearLevel' => $student && $student->year_level ? (string) $student->year_level : (string) $sub->year_level,
            'academicYear' => $sub->academic_year,
            'status' => $sub->status,
            'submittedAt' => $sub->submitted_at ? $sub->submitted_at->toIso8601String() : null,
            'updatedAt' => $sub->updated_at ? $sub->updated_at->toIso8601String() : null,
            'reviewedByStaffId' => $sub->reviewed_by,
            'reviewedByName' => $this->formatStaffName($reviewer),
            'reviewedByPosition' => $reviewer ? $reviewer->position : null,
        ];
    }

    /**
     * POST /submit-record
     * Student atomic intake transaction.
     */
    public function submitRecord(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) return response()->json(['error' => 'Unauthenticated.'], 401);

        $data = $request->all();
        $studentId = $user->student_id ?: ($data['studentId'] ?? null);

        if (! $studentId) {
            return response()->json(['error' => 'Student ID is required.'], 400);
        }

        $activeAy = SystemSetting::getVal('current_academic_year', 'SY 2025-2026');

        $submissionId = DB::transaction(function () use ($user, $studentId, $data, $activeAy) {
            // Upsert student demographics
            $student = Student::firstOrNew(['student_id' => $studentId]);
            $student->profile_id = $user->id;
            $student->first_name = $data['firstName'] ?? $student->first_name;
            $student->last_name = $data['lastName'] ?? $student->last_name;
            $student->middle_initial = $data['middleInitial'] ?? $student->middle_initial;
            $student->department = $data['department'] ?? $student->department;
            $student->course = $data['course'] ?? $student->course;
            $student->year_level = isset($data['yearLevel']) ? (int) $data['yearLevel'] : ($student->year_level ?: 1);
            $student->age = isset($data['age']) ? (int) $data['age'] : $student->age;
            $student->sex = $data['sex'] ?? $student->sex;
            $student->birthday = $data['birthday'] ?? $student->birthday;
            $student->civil_status = $data['civilStatus'] ?? $student->civil_status;
            $student->contact_number = $data['contactNumber'] ?? $student->contact_number;
            $student->address = $data['address'] ?? $student->address;
            $student->save();

            // Create submission
            $sub = Submission::create([
                'student_id' => $studentId,
                'first_name' => $data['firstName'] ?? '',
                'last_name' => $data['lastName'] ?? '',
                'middle_initial' => $data['middleInitial'] ?? null,
                'course' => $data['course'] ?? '',
                'department' => $data['department'] ?? '',
                'year_level' => $data['yearLevel'] ?? '1st Year',
                'academic_year' => $data['academicYear'] ?? $activeAy,
                'status' => 'pending',
                'age' => isset($data['age']) ? (string) $data['age'] : null,
                'sex' => $data['sex'] ?? null,
                'birthday' => $data['birthday'] ?? null,
                'civil_status' => $data['civilStatus'] ?? null,
                'contact_number' => $data['contactNumber'] ?? null,
                'address' => $data['address'] ?? null,
                'allergy_details' => $data['allergyDetails'] ?? null,
                'had_operation' => $data['hadOperation'] ?? 'no',
                'operation_details' => $data['operationDetails'] ?? null,
                'blood_pressure' => $data['bloodPressure'] ?? null,
                'weight' => $data['weight'] ?? null,
                'height' => $data['height'] ?? null,
                'bmi' => $data['bmi'] ?? null,
                'lab_test_location' => $data['labTestLocation'] ?? null,
                'lab_test_clinic' => $data['labTestClinic'] ?? null,
                'cbc_test_clinic' => $data['cbcTestClinic'] ?? null,
                'urinalysis_test_clinic' => $data['urinalysisTestClinic'] ?? null,
                'xray_test_clinic' => $data['xrayTestClinic'] ?? null,
            ]);

            // Emergency contact
            if (! empty($data['emergencyContact'])) {
                EmergencyContact::create([
                    'submission_id' => $sub->id,
                    'name' => $data['emergencyContact']['name'] ?? null,
                    'relationship' => $data['emergencyContact']['relationship'] ?? null,
                    'phone' => $data['emergencyContact']['phone'] ?? null,
                    'address' => $data['emergencyContact']['address'] ?? null,
                ]);
            }

            // Medical history
            if (! empty($data['medicalHistory'])) {
                $mh = $data['medicalHistory'];
                MedicalHistory::create([
                    'submission_id' => $sub->id,
                    'allergy' => ! empty($mh['allergy']),
                    'asthma' => ! empty($mh['asthma']),
                    'chicken_pox' => ! empty($mh['chickenPox']),
                    'diabetes' => ! empty($mh['diabetes']),
                    'dysmenorrhea' => ! empty($mh['dysmenorrhea']),
                    'epilepsy_seizure' => ! empty($mh['epilepsySeizure']),
                    'heart_disorder' => ! empty($mh['heartDisorder']),
                    'hepatitis' => ! empty($mh['hepatitis']),
                    'hypertension' => ! empty($mh['hypertension']),
                    'measles' => ! empty($mh['measles']),
                    'mumps' => ! empty($mh['mumps']),
                    'anxiety_disorder' => ! empty($mh['anxietyDisorder']),
                    'panic_attack' => ! empty($mh['panicAttack']),
                    'pneumonia' => ! empty($mh['pneumonia']),
                    'ptb_primary_complex' => ! empty($mh['ptbPrimaryComplex']),
                    'typhoid_fever' => ! empty($mh['typhoidFever']),
                    'covid19' => ! empty($mh['covid19']),
                    'uti' => ! empty($mh['uti']),
                ]);
            }

            // Lab: Chest X-ray
            if (! empty($data['chestXray'])) {
                $cx = $data['chestXray'];
                LabChestXray::create([
                    'submission_id' => $sub->id,
                    'xray_date' => $cx['date'] ?? null,
                    'xray_result' => $cx['result'] ?? null,
                    'xray_findings' => $cx['findings'] ?? null,
                    'file_url' => $cx['fileUrl'] ?? null,
                    'file_name' => $cx['fileName'] ?? null,
                ]);
            }

            // Lab: CBC
            if (! empty($data['cbc'])) {
                $cbc = $data['cbc'];
                LabCbc::create([
                    'submission_id' => $sub->id,
                    'cbc_date' => $cbc['date'] ?? null,
                    'hemoglobin' => $cbc['hemoglobin'] ?? null,
                    'hematocrit' => $cbc['hematocrit'] ?? null,
                    'wbc' => $cbc['wbc'] ?? null,
                    'platelet_count' => $cbc['plateletCount'] ?? null,
                    'blood_type' => $cbc['bloodType'] ?? null,
                    'glucose' => $cbc['glucose'] ?? null,
                    'protein' => $cbc['protein'] ?? null,
                    'file_url' => $cbc['fileUrl'] ?? null,
                    'file_name' => $cbc['fileName'] ?? null,
                ]);
            }

            // Lab: Urinalysis
            if (! empty($data['urinalysis'])) {
                $uri = $data['urinalysis'];
                LabUrinalysis::create([
                    'submission_id' => $sub->id,
                    'urinalysis_date' => $uri['date'] ?? null,
                    'glucose' => $uri['glucose'] ?? null,
                    'protein' => $uri['protein'] ?? null,
                    'file_url' => $uri['fileUrl'] ?? null,
                    'file_name' => $uri['fileName'] ?? null,
                ]);
            }

            // Link any uploaded FileRecords to this submission
            $fileUrls = array_filter([
                $data['chestXray']['fileUrl'] ?? null,
                $data['cbc']['fileUrl'] ?? null,
                $data['urinalysis']['fileUrl'] ?? null,
                $data['photoUrl'] ?? null,
                $data['signatureUrl'] ?? null,
            ]);

            $fileIds = [];
            foreach ($fileUrls as $url) {
                if (preg_match('/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/', (string) $url, $matches)) {
                    $fileIds[] = $matches[0];
                }
            }

            if (! empty($fileIds)) {
                FileRecord::whereIn('id', $fileIds)->update(['submission_id' => $sub->id]);
            }

            // Also link any files previously tagged with a client-side temporary record id or uploaded by this student
            $tempId = $data['recordId'] ?? $data['submissionId'] ?? null;
            if ($tempId && $tempId !== $sub->id) {
                FileRecord::where('submission_id', $tempId)
                    ->where('uploaded_by', $user->id)
                    ->update(['submission_id' => $sub->id]);
            }

            AuditLog::logAction('SUBMIT_RECORD', $user->id, $user->role, $studentId, $sub->id);

            return $sub->id;
        });

        return response()->json([
            'success' => true,
            'recordId' => $submissionId,
            'submissionId' => $submissionId,
        ]);
    }

    /**
     * GET /student-records or /student-records/{studentId}
     */
    public function getStudentRecords(Request $request, ?string $studentId = null): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $targetId = $studentId ?: ($user ? $user->student_id : null);

        if (! $targetId) {
            return response()->json(['error' => 'Student ID not specified.'], 400);
        }

        // Strict authorization: Only staff, doctors, nurses, admins or the specific student themselves
        $isStaff = $user->isStaff();
        if (! $isStaff && ($user->role !== 'student' || $user->student_id !== $targetId)) {
            return response()->json([
                'error' => 'Forbidden. You do not have permission to view this medical record.',
            ], 403);
        }

        $submissions = Submission::where('student_id', $targetId)
            ->with(['emergencyContact', 'medicalHistory', 'staffMeasurements', 'chestXray', 'cbc', 'urinalysis', 'certificate', 'files', 'student'])
            ->orderByDesc('submitted_at')
            ->get();

        $mapped = $submissions->map(fn ($s) => $this->mapSubmissionDetail($s));

        return response()->json([
            'records' => $mapped,
        ]);
    }

    /**
     * GET /submissions
     */
    public function getAllSubmissions(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        // Strict authorization: Only clinic staff, doctors, nurses, and admins can view all submissions
        if (! $user->isStaff()) {
            return response()->json([
                'error' => 'Forbidden. Only clinic staff, doctors, and admins can view all submissions.',
            ], 403);
        }

        $submissions = Submission::with(['student', 'certificate'])
            ->orderByDesc('submitted_at')
            ->limit(200)
            ->get();

        return response()->json([
            'submissions' => $submissions->map(fn ($s) => $this->mapSubmissionDetail($s)),
        ]);
    }

    /**
     * GET /submission/{id}
     */
    public function getSubmission(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $submission = Submission::with(['emergencyContact', 'medicalHistory', 'staffMeasurements', 'chestXray', 'cbc', 'urinalysis', 'certificate', 'files', 'student'])
            ->find($id);

        if (! $submission) {
            return response()->json(['error' => 'Submission record not found.'], 404);
        }

        // Strict authorization: Only staff, doctors, nurses, admins or the student who owns the submission
        $isStaff = $user->isStaff();
        if (! $isStaff && ($user->role !== 'student' || $user->student_id !== $submission->student_id)) {
            return response()->json([
                'error' => 'Forbidden. You do not have permission to view this medical submission.',
            ], 403);
        }

        $detail = $this->mapSubmissionDetail($submission);

        return response()->json(array_merge($detail, [
            'submission' => $detail,
        ]));
    }

    /**
     * PUT /submission/{id}/status
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $submission = Submission::find($id);

        if (! $submission) {
            return response()->json(['error' => 'Submission record not found.'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:pending,in_review,returned,resubmitted,physical_exam_done,approved'],
            'staffNotes' => ['nullable', 'string'],
        ]);

        $submission->status = $validated['status'];
        if (array_key_exists('staffNotes', $validated)) {
            $submission->staff_notes = $validated['staffNotes'];
        }
        $submission->reviewed_by = $user->id;
        $submission->save();

        // Create student notification if status is approved or returned
        if (in_array($submission->status, ['approved', 'returned'], true)) {
            $isApproved = $submission->status === 'approved';
            $notifKey = "sub_{$submission->id}_{$submission->status}";

            StudentNotification::updateOrCreate(
                [
                    'student_id' => $submission->student_id,
                    'notification_key' => $notifKey,
                ],
                [
                    'submission_id' => $submission->id,
                    'status' => $submission->status,
                    'title' => $isApproved ? 'Medical Clearance Approved' : 'Medical Submission Returned',
                    'message' => $isApproved
                        ? 'Your medical record clearance has been approved by the clinic staff.'
                        : 'Your medical record was returned with notes. Please review and update your submission.',
                    'note' => $submission->staff_notes,
                    'action_label' => $isApproved ? 'View Certificate' : 'Review Notes',
                    'action_path' => '/dashboard',
                    'year_label' => (string) $submission->year_level,
                    'occurred_at' => now(),
                    'is_read' => false,
                ]
            );
        }

        AuditLog::logAction('STATUS_UPDATE', $user->id, $user->role, $submission->student_id, $submission->id, null, [
            'new_status' => $submission->status,
            'notes' => $submission->staff_notes,
        ]);

        return response()->json([
            'success' => true,
            'status' => $submission->status,
            'submission' => $this->mapSubmissionDetail($submission),
        ]);
    }

    /**
     * PUT /submission/{id}/measurements
     */
    public function updateMeasurements(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $submission = Submission::find($id);

        if (! $submission) {
            return response()->json(['error' => 'Submission not found.'], 404);
        }

        $data = $request->all();
        $m = StaffMeasurement::firstOrNew(['submission_id' => $id]);

        $fields = [
            'bloodPressure' => 'blood_pressure',
            'cardiacRate' => 'cardiac_rate',
            'respiratoryRate' => 'respiratory_rate',
            'temperature' => 'temperature',
            'weight' => 'weight',
            'height' => 'height',
            'bmi' => 'bmi',
            'visualAcuity' => 'visual_acuity',
            'skin' => 'skin',
            'heent' => 'heent',
            'chestLungs' => 'chest_lungs',
            'heart' => 'heart',
            'abdomen' => 'abdomen',
            'extremities' => 'extremities',
            'others' => 'others',
            'examinedBy' => 'examined_by',
            'examinedBySignatureUrl' => 'examined_by_signature_url',
        ];

        foreach ($fields as $inputKey => $dbCol) {
            if (isset($data[$inputKey])) {
                $m->{$dbCol} = $data[$inputKey];
            }
        }

        $m->updated_by = $user->id;
        $m->save();

        AuditLog::logAction('MEASUREMENTS_UPDATE', $user->id, $user->role, $submission->student_id, $id);

        return response()->json([
            'success' => true,
            'measurements' => $m,
        ]);
    }

    /**
     * GET /staff/dashboard-overview
     */
    public function getDashboardOverview(Request $request): JsonResponse
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();
        $weekStart = now()->startOfWeek();
        $monthStart = now()->startOfMonth();

        $total = Submission::count();
        $approved = Submission::where('status', 'approved')->count();
        $pending = Submission::where('status', 'pending')->count();
        $inReview = Submission::where('status', 'in_review')->count();
        $returned = Submission::where('status', 'returned')->count();
        $resubmitted = Submission::where('status', 'resubmitted')->count();

        $submittedToday = Submission::where('submitted_at', '>=', $today)->count();
        $submittedYesterday = Submission::whereBetween('submitted_at', [$yesterday, $today])->count();
        $submittedThisWeek = Submission::where('submitted_at', '>=', $weekStart)->count();
        $submittedThisMonth = Submission::where('submitted_at', '>=', $monthStart)->count();

        // Queues (up to 20 each)
        $reviewers = StaffUser::all()->keyBy('profile_id')->all();
        $mapQueue = fn ($rows) => $rows->map(fn ($s) => $this->mapSubmissionSummary($s, $reviewers));

        $pendingQueue = $mapQueue(Submission::with('student')->where('status', 'pending')->orderByDesc('submitted_at')->limit(20)->get());
        $inReviewQueue = $mapQueue(Submission::with('student')->where('status', 'in_review')->orderByDesc('submitted_at')->limit(20)->get());
        $returnedQueue = $mapQueue(Submission::with('student')->where('status', 'returned')->orderByDesc('submitted_at')->limit(20)->get());
        $resubmittedQueue = $mapQueue(Submission::with('student')->where('status', 'resubmitted')->orderByDesc('submitted_at')->limit(20)->get());

        // Department breakdown
        $departments = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
        $departmentCounts = [];
        foreach ($departments as $dept) {
            $departmentCounts[$dept] = [
                'total' => Submission::where('department', $dept)->count(),
                'approved' => Submission::where('department', $dept)->where('status', 'approved')->count(),
                'pending' => Submission::where('department', $dept)->where('status', 'pending')->count(),
            ];
        }

        return response()->json([
            'totalSubmissions' => $total,
            'approvedRecords' => $approved,
            'pendingRecords' => $pending,
            'inReviewRecords' => $inReview,
            'returnedRecords' => $returned,
            'resubmittedRecords' => $resubmitted,
            'submittedToday' => $submittedToday,
            'submittedYesterday' => $submittedYesterday,
            'submittedThisWeek' => $submittedThisWeek,
            'submittedThisMonth' => $submittedThisMonth,
            'pendingQueue' => $pendingQueue,
            'inReviewQueue' => $inReviewQueue,
            'returnedQueue' => $returnedQueue,
            'resubmittedQueue' => $resubmittedQueue,
            'departmentCounts' => $departmentCounts,
        ]);
    }

    /**
     * GET /staff/submission-summaries
     */
    public function getSubmissionSummaries(Request $request): JsonResponse
    {
        $query = Submission::query()->with('student');

        // Filter: Status
        $status = strtolower(trim($request->query('status', $request->query('statusFilter', 'action_needed'))));
        if ($status === 'action_needed') {
            $query->whereIn('status', ['pending', 'in_review', 'returned', 'resubmitted']);
        } elseif ($status !== 'all' && ! empty($status)) {
            $query->where('status', $status);
        }

        // Filter: Department
        $dept = $request->query('department', $request->query('departmentFilter'));
        if ($dept && $dept !== 'all') {
            $query->where('department', $dept);
        }

        // Filter: Year
        $year = $request->query('year', $request->query('yearFilter'));
        if ($year && $year !== 'all') {
            $query->where('year_level', $year);
        }

        // Filter: Search Query (Student ID, First Name, Last Name)
        $search = trim($request->query('search', $request->query('searchQuery', '')));
        if (! empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('student_id', 'LIKE', "%{$search}%")
                  ->orWhere('first_name', 'LIKE', "%{$search}%")
                  ->orWhere('last_name', 'LIKE', "%{$search}%");
            });
        }

        $sortOrder = strtolower($request->query('sort', $request->query('sortOrder', 'desc'))) === 'asc' ? 'asc' : 'desc';
        $query->orderBy('submitted_at', $sortOrder);

        $page = max(1, (int) $request->query('page', 1));
        $pageSize = min(100, max(1, (int) $request->query('pageSize', 25)));

        $total = $query->count();
        $items = $query->skip(($page - 1) * $pageSize)->take($pageSize)->get();

        $reviewers = StaffUser::all()->keyBy('profile_id')->all();

        $allCount = Submission::count();
        $actionNeededCount = Submission::whereIn('status', ['pending', 'in_review', 'returned', 'resubmitted'])->count();
        $pendingCount = Submission::where('status', 'pending')->count();
        $inReviewCount = Submission::where('status', 'in_review')->count();
        $returnedCount = Submission::where('status', 'returned')->count();
        $resubmittedCount = Submission::where('status', 'resubmitted')->count();
        $approvedCount = Submission::where('status', 'approved')->count();

        return response()->json([
            'items' => $items->map(fn ($s) => $this->mapSubmissionSummary($s, $reviewers)),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'counts' => [
                'all' => $allCount,
                'action_needed' => $actionNeededCount,
                'actionNeeded' => $actionNeededCount,
                'pending' => $pendingCount,
                'in_review' => $inReviewCount,
                'inReview' => $inReviewCount,
                'returned' => $returnedCount,
                'resubmitted' => $resubmittedCount,
                'approved' => $approvedCount,
            ],
        ]);
    }

    /**
     * GET /staff/submission-report-summaries
     */
    public function getSubmissionReportSummaries(Request $request): JsonResponse
    {
        $submissions = Submission::select([
            'id', 'student_id', 'department', 'course', 'year_level', 'sex', 'status', 'submitted_at', 'updated_at', 'academic_year',
        ])->orderByDesc('submitted_at')->get();

        $students = Student::all();
        $profiles = Profile::where('role', 'student')->get()->keyBy('id');

        $registered = $students->map(function ($st) use ($profiles) {
            $prof = $st->profile_id ? ($profiles[$st->profile_id] ?? null) : null;
            return [
                'studentId' => $st->student_id,
                'profileId' => $st->profile_id,
                'firstName' => $st->first_name ?: ($prof->first_name ?? ''),
                'lastName' => $st->last_name ?: ($prof->last_name ?? ''),
                'department' => $st->department ?: ($prof->department ?? ''),
                'course' => $st->course ?: ($prof->course ?? ''),
                'year' => (string) $st->year_level,
                'studentYearLevel' => (string) $st->year_level,
                'sex' => $st->sex ?: '',
                'registeredAt' => $st->created_at ? $st->created_at->toIso8601String() : null,
            ];
        });

        return response()->json([
            'submissions' => $submissions->map(fn ($s) => [
                'id' => $s->id,
                'studentId' => $s->student_id,
                'department' => $s->department,
                'course' => $s->course,
                'year' => (string) $s->year_level,
                'studentYearLevel' => (string) $s->year_level,
                'sex' => $s->sex ?: '',
                'status' => $s->status,
                'submittedAt' => $s->submitted_at ? $s->submitted_at->toIso8601String() : null,
                'updatedAt' => $s->updated_at ? $s->updated_at->toIso8601String() : null,
                'academicYear' => $s->academic_year,
            ]),
            'registeredStudents' => $registered,
        ]);
    }

    /**
     * GET /staff/approved-students
     */
    public function getApprovedStudents(Request $request): JsonResponse
    {
        $query = Submission::where('status', 'approved')->with(['certificate', 'student']);

        if ($dept = $request->query('department')) {
            $query->where('department', $dept);
        }
        if ($search = trim($request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('student_id', 'LIKE', "%{$search}%")
                  ->orWhere('first_name', 'LIKE', "%{$search}%")
                  ->orWhere('last_name', 'LIKE', "%{$search}%");
            });
        }

        $page = max(1, (int) $request->query('page', 1));
        $pageSize = min(50, max(1, (int) $request->query('pageSize', 20)));

        $total = $query->count();
        $submissions = $query->orderByDesc('submitted_at')->skip(($page - 1) * $pageSize)->take($pageSize)->get();

        $items = $submissions->map(function ($s) {
            return [
                'submissionId' => $s->id,
                'studentId' => $s->student_id,
                'firstName' => $s->first_name,
                'lastName' => $s->last_name,
                'middleInitial' => $s->middle_initial ?: '',
                'course' => $s->course,
                'department' => $s->department,
                'yearLevel' => (string) $s->year_level,
                'academicYear' => $s->academic_year,
                'approvedAt' => $s->updated_at ? $s->updated_at->toIso8601String() : null,
                'hasCertificate' => (bool) $s->certificate,
                'certificateControlNo' => $s->certificate ? $s->certificate->control_no : null,
                'certificatePdfUrl' => $s->certificate ? $s->certificate->pdf_url : null,
            ];
        });

        return response()->json([
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
        ]);
    }
}
