<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Certificate;
use App\Models\Profile;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CertificateController extends Controller
{
    /**
     * POST /issue-certificate
     */
    public function issueCertificate(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'submissionId' => ['required', 'string'],
            'findingsNormal' => ['nullable', 'boolean'],
            'diagnosis' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
            'purpose' => ['nullable', 'string'],
            'controlNo' => ['nullable', 'string'],
            'licenseNo' => ['nullable', 'string'],
            'signatoryName' => ['nullable', 'string'],
            'pdfUrl' => ['nullable', 'string'],
        ]);

        $submission = Submission::find($validated['submissionId']);
        if (! $submission) {
            return response()->json(['error' => 'Submission not found.'], 404);
        }

        // Generate control number if empty
        $controlNo = $validated['controlNo'] ?? null;
        if (empty($controlNo)) {
            $year = date('Y');
            $randomNum = str_pad((string) random_int(1000, 999999), 6, '0', STR_PAD_LEFT);
            $controlNo = "GC-MC-{$year}-{$randomNum}";
        }

        $cert = Certificate::updateOrCreate(
            ['submission_id' => $submission->id],
            [
                'findings_normal' => $validated['findingsNormal'] ?? true,
                'diagnosis' => $validated['diagnosis'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
                'purpose' => $validated['purpose'] ?? 'Enrollment Medical Clearance',
                'control_no' => $controlNo,
                'issued_date' => now()->toDateString(),
                'issued_at' => now(),
                'license_no' => $validated['licenseNo'] ?? null,
                'signatory_name' => $validated['signatoryName'] ?? ($user ? "{$user->first_name} {$user->last_name}" : null),
                'pdf_url' => $validated['pdfUrl'] ?? null,
            ]
        );

        // Ensure submission status is approved
        if ($submission->status !== 'approved') {
            $submission->status = 'approved';
            $submission->reviewed_by = $user->id;
            $submission->save();
        }

        AuditLog::logAction('ISSUE_CERTIFICATE', $user->id, $user->role, $submission->student_id, $submission->id, null, [
            'control_no' => $controlNo,
        ]);

        return response()->json([
            'success' => true,
            'certificate' => $cert,
        ]);
    }

    /**
     * GET /staff/certificate-records/{studentId}
     */
    public function getStudentCertificates(Request $request, string $studentId): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $isStaff = $user->isStaff();
        if (! $isStaff && ($user->role !== 'student' || $user->student_id !== $studentId)) {
            return response()->json([
                'error' => 'Forbidden. You do not have permission to access another student\'s medical certificate.',
            ], 403);
        }

        $submissions = Submission::where('student_id', $studentId)
            ->whereHas('certificate')
            ->with(['certificate', 'student'])
            ->orderByDesc('submitted_at')
            ->get();

        $records = $submissions->map(function ($s) {
            $cert = $s->certificate;
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
                'controlNo' => $cert->control_no,
                'issuedDate' => $cert->issued_date ? $cert->issued_date->format('Y-m-d') : null,
                'issuedAt' => $cert->issued_at ? $cert->issued_at->toIso8601String() : null,
                'licenseNo' => $cert->license_no,
                'signatoryName' => $cert->signatory_name,
                'findingsNormal' => (bool) $cert->findings_normal,
                'diagnosis' => $cert->diagnosis,
                'remarks' => $cert->remarks,
                'purpose' => $cert->purpose,
                'pdfUrl' => $cert->pdf_url,
            ];
        });

        return response()->json([
            'records' => $records,
            'success' => true,
        ]);
    }
}
