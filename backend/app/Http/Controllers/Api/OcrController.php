<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FileRecord;
use App\Models\LabCbc;
use App\Models\LabChestXray;
use App\Models\LabUrinalysis;
use App\Models\Profile;
use App\Models\Student;
use App\Models\Submission;
use App\Services\OcrService;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class OcrController extends Controller
{
    protected OcrService $ocrService;
    protected StorageService $storageService;

    public function __construct(OcrService $ocrService, StorageService $storageService)
    {
        $this->ocrService = $ocrService;
        $this->storageService = $storageService;
    }

    /**
     * Resolve submission by primary ID or student_id.
     */
    protected function findSubmission(string $id): ?Submission
    {
        $submission = Submission::find($id);
        if (! $submission) {
            $submission = Submission::where('student_id', $id)->latest('submitted_at')->first();
        }
        return $submission;
    }

    /**
     * Resolve binary content and metadata from a submission lab file or request.
     *
     * @return array{content: string, fileName: string, mimeType: string, fileRecord: ?FileRecord}|null
     */
    protected function resolveFileBinary(Submission $submission, string $type, Request $request): ?array
    {
        // 1. Direct file in request
        if ($request->hasFile('file')) {
            $uploaded = $request->file('file');
            return [
                'content' => file_get_contents($uploaded->getRealPath()),
                'fileName' => $uploaded->getClientOriginalName(),
                'mimeType' => $uploaded->getMimeType() ?: 'application/octet-stream',
                'fileRecord' => null,
            ];
        }

        // 2. Base64 in request
        if ($request->filled('base64')) {
            $data = $request->input('base64');
            $mimeType = 'image/jpeg';
            if (str_contains($data, ';base64,')) {
                $parts = explode(';base64,', $data);
                $data = $parts[1];
                $mimeType = str_replace('data:', '', $parts[0]);
            }
            return [
                'content' => base64_decode($data),
                'fileName' => $request->input('fileName', "lab_{$type}.jpg"),
                'mimeType' => $mimeType,
                'fileRecord' => null,
            ];
        }

        // 3. Category types mapping
        $types = match ($type) {
            'xray' => ['xray', 'chest_xray', 'chest-xray', 'lab_xray'],
            'cbc' => ['cbc', 'lab_cbc'],
            'urinalysis' => ['urinalysis', 'lab_urinalysis'],
            default => [$type],
        };

        // 3.1 Try to find FileRecord directly attached to this submission
        $fileRecord = FileRecord::where('submission_id', $submission->id)
            ->whereIn('type', $types)
            ->latest('uploaded_at')
            ->first();

        // 3.2 Try to resolve via the lab record
        $labRow = match ($type) {
            'xray' => $submission->chestXray,
            'cbc' => $submission->cbc,
            'urinalysis' => $submission->urinalysis,
            default => null,
        };

        if (! $fileRecord && $labRow) {
            // Check if lab record already has file_id
            if (! empty($labRow->file_id)) {
                $fileRecord = FileRecord::find($labRow->file_id);
            }

            // Check if file_url contains a UUID
            if (! $fileRecord && ! empty($labRow->file_url)) {
                if (preg_match('/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/', $labRow->file_url, $matches)) {
                    $fileRecord = FileRecord::find($matches[0]);
                }
            }

            // Check if exact URL exists in files table
            if (! $fileRecord && ! empty($labRow->file_url)) {
                $fileRecord = FileRecord::where('url', $labRow->file_url)->first();
            }

            // Check if file_name matches a file record for this student
            if (! $fileRecord && ! empty($labRow->file_name)) {
                $fileRecord = FileRecord::where('file_name', $labRow->file_name)
                    ->whereIn('type', $types)
                    ->latest('uploaded_at')
                    ->first();
            }
        }

        // 3.3 Try to find via student profile uploads (uploaded before submission was finalized)
        if (! $fileRecord && $submission->student_id) {
            $studentProfile = Profile::where('student_id', $submission->student_id)->first();
            if (! $studentProfile) {
                $student = Student::where('student_id', $submission->student_id)->first();
                if ($student?->profile_id) {
                    $studentProfile = Profile::find($student->profile_id);
                }
            }

            if ($studentProfile) {
                $fileRecord = FileRecord::where('uploaded_by', $studentProfile->id)
                    ->whereIn('type', $types)
                    ->latest('uploaded_at')
                    ->first();
            }
        }

        // 3.4 Check other submissions for this exact student (resubmission or previous semester)
        if (! $fileRecord && $submission->student_id) {
            $otherSubIds = Submission::where('student_id', $submission->student_id)
                ->where('id', '!=', $submission->id)
                ->pluck('id');

            if ($otherSubIds->isNotEmpty()) {
                $fileRecord = FileRecord::whereIn('submission_id', $otherSubIds)
                    ->whereIn('type', $types)
                    ->latest('uploaded_at')
                    ->first();
            }
        }

        // If file record was discovered through student/profile and lacks submission_id, link it now
        if ($fileRecord && empty($fileRecord->submission_id)) {
            $fileRecord->update(['submission_id' => $submission->id]);
        }

        // 4. Read binary content from FileRecord
        if ($fileRecord) {
            try {
                $content = $this->storageService->readFile($fileRecord);
                $detectedMime = $fileRecord->mime_type;
                if (function_exists('finfo_open')) {
                    $finfo = finfo_open(FILEINFO_MIME_TYPE);
                    if ($finfo) {
                        $buffMime = @finfo_buffer($finfo, $content);
                        if ($buffMime) {
                            $detectedMime = $buffMime;
                        }
                        finfo_close($finfo);
                    }
                }

                return [
                    'content' => $content,
                    'fileName' => $fileRecord->file_name ?: "lab_{$type}.bin",
                    'mimeType' => $detectedMime ?: 'application/octet-stream',
                    'fileRecord' => $fileRecord,
                ];
            } catch (\Throwable) {
                // Fallback to direct HTTP fetch if remote
                if ($fileRecord->url && filter_var($fileRecord->url, FILTER_VALIDATE_URL)) {
                    $resp = Http::timeout(25)->get($fileRecord->url);
                    if ($resp->successful()) {
                        return [
                            'content' => $resp->body(),
                            'fileName' => $fileRecord->file_name ?: "lab_{$type}.bin",
                            'mimeType' => $fileRecord->mime_type ?: 'application/octet-stream',
                            'fileRecord' => $fileRecord,
                        ];
                    }
                }
            }
        }

        // 5. Fallback: direct HTTP fetch if labRow has a remote URL (e.g. legacy Cloudinary)
        if ($labRow && ! empty($labRow->file_url) && filter_var($labRow->file_url, FILTER_VALIDATE_URL)) {
            try {
                $resp = Http::timeout(25)->get($labRow->file_url);
                if ($resp->successful()) {
                    return [
                        'content' => $resp->body(),
                        'fileName' => $labRow->file_name ?: "lab_{$type}.bin",
                        'mimeType' => $labRow->mime_type ?: 'image/jpeg',
                        'fileRecord' => null,
                    ];
                }
            } catch (\Throwable) {}
        }

        return null;
    }

    /**
     * POST /submission/{id}/chest-xray-ocr
     */
    public function parseChestXray(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $submission = $this->findSubmission($id);
        if (! $submission) {
            return response()->json(['error' => "Submission not found for ID [{$id}]."], 404);
        }

        $fileData = $this->resolveFileBinary($submission, 'xray', $request);
        if (! $fileData) {
            return response()->json([
                'error' => "No Chest X-Ray document found for student {$submission->student_id}.",
                'studentId' => $submission->student_id,
                'submissionId' => $submission->id,
            ], 422);
        }

        $parsed = $this->ocrService->parseDocument(
            'chest-xray',
            $fileData['content'],
            $fileData['fileName'],
            $fileData['mimeType']
        );

        // Update lab record
        $labUpdate = [
            'xray_date' => $parsed['date'] ?? null,
            'xray_findings' => $parsed['findings'] ?? null,
            'xray_result' => $parsed['result'] ?? 'normal',
            'media_updated_at' => now(),
        ];

        if (! empty($fileData['fileRecord'])) {
            $labUpdate['file_id'] = $fileData['fileRecord']->id;
            if (! empty($fileData['fileRecord']->url)) {
                $labUpdate['file_url'] = $fileData['fileRecord']->url;
            }
            if (! empty($fileData['fileRecord']->file_name)) {
                $labUpdate['file_name'] = $fileData['fileRecord']->file_name;
            }
            if (! empty($fileData['fileRecord']->mime_type)) {
                $labUpdate['mime_type'] = $fileData['fileRecord']->mime_type;
            }
        }

        LabChestXray::updateOrCreate(['submission_id' => $submission->id], $labUpdate);

        AuditLog::logAction('OCR_RUN_CHEST_XRAY', $user?->id, $user?->role, $submission->student_id, $submission->id);

        return response()->json([
            'success' => true,
            'date' => $parsed['date'] ?? null,
            'findings' => $parsed['findings'] ?? null,
            'result' => $parsed['result'] ?? 'normal',
            'confidence' => $parsed['confidence'] ?? 90,
            'pageCount' => $parsed['pageCount'] ?? 1,
            'rawText' => $parsed['rawText'] ?? '',
            'source' => $parsed['source'] ?? 'ocr-space',
            'provider' => $parsed['provider'] ?? 'ocr-space',
        ]);
    }

    /**
     * POST /submission/{id}/cbc-ocr
     */
    public function parseCbc(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $submission = $this->findSubmission($id);
        if (! $submission) {
            return response()->json(['error' => "Submission not found for ID [{$id}]."], 404);
        }

        $fileData = $this->resolveFileBinary($submission, 'cbc', $request);
        if (! $fileData) {
            return response()->json([
                'error' => "No CBC document found for student {$submission->student_id}.",
                'studentId' => $submission->student_id,
                'submissionId' => $submission->id,
            ], 422);
        }

        $parsed = $this->ocrService->parseDocument(
            'cbc',
            $fileData['content'],
            $fileData['fileName'],
            $fileData['mimeType']
        );

        $labUpdate = [
            'cbc_date' => $parsed['date'] ?? null,
            'hemoglobin' => $parsed['hemoglobin'] ?? null,
            'hematocrit' => $parsed['hematocrit'] ?? null,
            'wbc' => $parsed['wbc'] ?? null,
            'platelet_count' => $parsed['plateletCount'] ?? null,
            'blood_type' => $parsed['bloodType'] ?? null,
            'media_updated_at' => now(),
        ];

        if (! empty($fileData['fileRecord'])) {
            $labUpdate['file_id'] = $fileData['fileRecord']->id;
            if (! empty($fileData['fileRecord']->url)) {
                $labUpdate['file_url'] = $fileData['fileRecord']->url;
            }
            if (! empty($fileData['fileRecord']->file_name)) {
                $labUpdate['file_name'] = $fileData['fileRecord']->file_name;
            }
            if (! empty($fileData['fileRecord']->mime_type)) {
                $labUpdate['mime_type'] = $fileData['fileRecord']->mime_type;
            }
        }

        LabCbc::updateOrCreate(['submission_id' => $submission->id], $labUpdate);

        AuditLog::logAction('OCR_RUN_CBC', $user?->id, $user?->role, $submission->student_id, $submission->id);

        return response()->json([
            'success' => true,
            'fields' => [
                'date' => $parsed['date'] ?? null,
                'hemoglobin' => $parsed['hemoglobin'] ?? null,
                'hematocrit' => $parsed['hematocrit'] ?? null,
                'wbc' => $parsed['wbc'] ?? null,
                'plateletCount' => $parsed['plateletCount'] ?? null,
                'bloodType' => $parsed['bloodType'] ?? null,
            ],
            'pageCount' => $parsed['pageCount'] ?? 1,
            'rawText' => $parsed['rawText'] ?? '',
            'source' => $parsed['source'] ?? 'ocr-space',
            'provider' => $parsed['provider'] ?? 'ocr-space',
        ]);
    }

    /**
     * POST /submission/{id}/urinalysis-ocr
     */
    public function parseUrinalysis(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $submission = $this->findSubmission($id);
        if (! $submission) {
            return response()->json(['error' => "Submission not found for ID [{$id}]."], 404);
        }

        $fileData = $this->resolveFileBinary($submission, 'urinalysis', $request);
        if (! $fileData) {
            return response()->json([
                'error' => "No Urinalysis document found for student {$submission->student_id}.",
                'studentId' => $submission->student_id,
                'submissionId' => $submission->id,
            ], 422);
        }

        $parsed = $this->ocrService->parseDocument(
            'urinalysis',
            $fileData['content'],
            $fileData['fileName'],
            $fileData['mimeType']
        );

        $labUpdate = [
            'urinalysis_date' => $parsed['date'] ?? null,
            'glucose' => $parsed['glucose'] ?? 'Negative',
            'protein' => $parsed['protein'] ?? 'Negative',
            'media_updated_at' => now(),
        ];

        if (! empty($fileData['fileRecord'])) {
            $labUpdate['file_id'] = $fileData['fileRecord']->id;
            if (! empty($fileData['fileRecord']->url)) {
                $labUpdate['file_url'] = $fileData['fileRecord']->url;
            }
            if (! empty($fileData['fileRecord']->file_name)) {
                $labUpdate['file_name'] = $fileData['fileRecord']->file_name;
            }
            if (! empty($fileData['fileRecord']->mime_type)) {
                $labUpdate['mime_type'] = $fileData['fileRecord']->mime_type;
            }
        }

        LabUrinalysis::updateOrCreate(['submission_id' => $submission->id], $labUpdate);

        AuditLog::logAction('OCR_RUN_URINALYSIS', $user?->id, $user?->role, $submission->student_id, $submission->id);

        return response()->json([
            'success' => true,
            'fields' => [
                'date' => $parsed['date'] ?? null,
                'glucose' => $parsed['glucose'] ?? 'Negative',
                'protein' => $parsed['protein'] ?? 'Negative',
            ],
            'pageCount' => $parsed['pageCount'] ?? 1,
            'rawText' => $parsed['rawText'] ?? '',
            'source' => $parsed['source'] ?? 'ocr-space',
            'provider' => $parsed['provider'] ?? 'ocr-space',
        ]);
    }
}
