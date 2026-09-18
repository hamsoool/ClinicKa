<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FileRecord;
use App\Models\LabCbc;
use App\Models\LabChestXray;
use App\Models\LabUrinalysis;
use App\Models\Profile;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\Submission;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StorageController extends Controller
{
    protected StorageService $storageService;

    public function __construct(StorageService $storageService)
    {
        $this->storageService = $storageService;
    }

    /**
     * Unified secure upload endpoint.
     * POST /api/v1/storage/upload
     */
    public function upload(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
        }

        $category = $request->input('category') ?: $request->input('type') ?: 'photo';
        $submissionId = $request->input('submissionId') ?: $request->input('submission_id');

        // Only clinic staff, doctors, and admins can upload announcement banners
        if ($category === 'announcement' && ! $user->isStaff()) {
            return response()->json(['error' => 'Forbidden. Only clinic staff, doctors, and administrators can upload announcement images.'], Response::HTTP_FORBIDDEN);
        }

        try {
            if ($request->hasFile('file')) {
                $file = $request->file('file');
                $fileRecord = $this->storageService->storeFile(
                    $file,
                    $category,
                    $file->getClientOriginalName(),
                    $submissionId,
                    $user->id
                );
            } elseif ($request->filled('base64')) {
                $base64 = $request->input('base64');
                if (str_contains($base64, ';base64,')) {
                    $base64 = explode(';base64,', $base64)[1];
                }
                $binary = base64_decode($base64);
                $originalName = $request->input('fileName', "upload_{$category}.png");

                $fileRecord = $this->storageService->storeFile(
                    $binary,
                    $category,
                    $originalName,
                    $submissionId,
                    $user->id
                );
            } else {
                return response()->json(['error' => 'No file or base64 payload provided.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            // Auto-prune previous replaced files in single-item categories (photo, signature)
            if (in_array($category, ['photo', 'signature'], true)) {
                $oldFiles = FileRecord::where('uploaded_by', $user->id)
                    ->where('type', $category)
                    ->where('id', '!=', $fileRecord->id)
                    ->get();
                foreach ($oldFiles as $old) {
                    $this->storageService->pruneFile($old, $user->id);
                }
            }

            // Sync student/staff media URLs if photo or signature
            if ($category === 'photo' && $user->role === 'student' && $user->student_id) {
                Student::where('student_id', $user->student_id)->update([
                    'profile_photo_url' => $fileRecord->url,
                    'profile_photo_file_name' => $fileRecord->file_name,
                    'media_updated_at' => now(),
                ]);
            } elseif ($category === 'signature') {
                if ($user->role === 'student' && $user->student_id) {
                    Student::where('student_id', $user->student_id)->update([
                        'signature_url' => $fileRecord->url,
                        'signature_file_name' => $fileRecord->file_name,
                        'media_updated_at' => now(),
                    ]);
                } elseif ($user->isStaff()) {
                    $staff = StaffUser::firstOrNew(['profile_id' => $user->id]);
                    $staff->email = $user->email;
                    $staff->first_name = $staff->first_name ?: ($user->first_name ?? '');
                    $staff->last_name = $staff->last_name ?: ($user->last_name ?? '');
                    $staff->signature_url = $fileRecord->url;
                    $staff->signature_file_name = $fileRecord->file_name;
                    $staff->save();
                }
            } elseif ($submissionId && in_array($category, ['xray', 'chest_xray', 'cbc', 'urinalysis'], true)) {
                // Automatically link uploaded laboratory files to the student's submission record
                if (in_array($category, ['xray', 'chest_xray'], true)) {
                    LabChestXray::updateOrCreate(
                        ['submission_id' => $submissionId],
                        [
                            'file_url' => $fileRecord->url,
                            'file_name' => $fileRecord->file_name,
                        ]
                    );
                } elseif ($category === 'cbc') {
                    LabCbc::updateOrCreate(
                        ['submission_id' => $submissionId],
                        [
                            'file_url' => $fileRecord->url,
                            'file_name' => $fileRecord->file_name,
                        ]
                    );
                } elseif ($category === 'urinalysis') {
                    LabUrinalysis::updateOrCreate(
                        ['submission_id' => $submissionId],
                        [
                            'file_url' => $fileRecord->url,
                            'file_name' => $fileRecord->file_name,
                        ]
                    );
                }
            }

            return response()->json([
                'success' => true,
                'fileId' => $fileRecord->id,
                'url' => $fileRecord->url,
                'fileName' => $fileRecord->file_name,
                'mimeType' => $fileRecord->mime_type,
                'fileHash' => $fileRecord->file_hash,
                'file' => $fileRecord,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'File upload failed: ' . $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Determine if a user is strictly authorized to view or stream a medical file.
     * Only clinic staff, doctors, nurses, admins, or the student who owns/uploaded the file have access.
     */
    protected function isAuthorizedToAccessFile(Profile $user, FileRecord $file): bool
    {
        // 0. Announcements are public notices accessible to all students and staff
        if ($file->type === 'announcement') {
            return true;
        }

        // 1. Clinic staff, nurses, doctors, physicians, and administrators have full medical access
        if ($user->isStaff()) {
            return true;
        }

        // Only students beyond this point
        if ($user->role !== 'student') {
            return false;
        }

        // 2. The exact student account that uploaded the file
        if ($file->uploaded_by && $file->uploaded_by === $user->id) {
            return true;
        }

        // 3. The student whose medical submission this file is linked to
        if ($file->submission_id && $user->student_id) {
            $sub = Submission::find($file->submission_id);
            if ($sub && $sub->student_id === $user->student_id) {
                return true;
            }
        }

        // 4. Student profile identity assets (photo or signature)
        if ($user->student_id) {
            $student = Student::where('student_id', $user->student_id)->first();
            if ($student) {
                $matchesProfile = ($student->profile_photo_url && str_contains((string) $student->profile_photo_url, $file->id))
                    || ($student->signature_url && str_contains((string) $student->signature_url, $file->id));
                if ($matchesProfile) {
                    return true;
                }
            }

            // 5. Check if file is referenced in any of the student's submissions (lab reports or certificates)
            $subIds = Submission::where('student_id', $user->student_id)->pluck('id');
            if ($subIds->isNotEmpty()) {
                $hasMatch = LabChestXray::whereIn('submission_id', $subIds)->where(function ($q) use ($file) {
                        $q->where('file_id', $file->id)->orWhere('file_url', 'like', "%{$file->id}%");
                    })->exists()
                    || LabCbc::whereIn('submission_id', $subIds)->where(function ($q) use ($file) {
                        $q->where('file_id', $file->id)->orWhere('file_url', 'like', "%{$file->id}%");
                    })->exists()
                    || LabUrinalysis::whereIn('submission_id', $subIds)->where(function ($q) use ($file) {
                        $q->where('file_id', $file->id)->orWhere('file_url', 'like', "%{$file->id}%");
                    })->exists()
                    || \App\Models\Certificate::whereIn('submission_id', $subIds)->where(function ($q) use ($file) {
                        $q->where('file_id', $file->id)->orWhere('pdf_url', 'like', "%{$file->id}%");
                    })->exists();
                if ($hasMatch) {
                    return true;
                }

                // 6. Clinic staff/nurse signature attached to the student's physical examination
                if ($file->type === 'signature') {
                    $hasExamSignature = \App\Models\StaffMeasurement::whereIn('submission_id', $subIds)
                        ->where('examined_by_signature_url', 'like', "%{$file->id}%")
                        ->exists();
                    if ($hasExamSignature) {
                        return true;
                    }
                }
            }
        }

        // Disallow any other student or unauthorized entity
        return false;
    }

    /**
     * Legacy Cloudinary Prepare adapter (returns direct local ticket).
     */
    public function prepareUpload(Request $request): JsonResponse
    {
        return response()->json([
            'uploadUrl' => '/api/v1/storage/upload',
            'directUpload' => true,
            'provider' => 'local_hardened',
        ]);
    }

    /**
     * Legacy Cloudinary Complete adapter.
     */
    public function completeUpload(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'url' => $request->input('url'),
            'fileId' => $request->input('fileId'),
        ]);
    }

    /**
     * Generate a short-lived (60s) HMAC-signed streaming ticket.
     * Prevents leaking long-lived authentication tokens in URLs and browser history.
     * GET /api/v1/storage/ticket/{id}
     */
    public function createStreamingTicket(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
        }

        $file = FileRecord::find($id);
        if (! $file) {
            return response()->json(['error' => 'File record not found.'], Response::HTTP_NOT_FOUND);
        }

        // Enforce strict access control
        if ($file->type !== 'announcement' && ! $this->isAuthorizedToAccessFile($user, $file)) {
            return response()->json([
                'error' => 'Forbidden. You do not have permission to access this medical document.',
            ], Response::HTTP_FORBIDDEN);
        }

        $ticket = $this->storageService->generateStreamingTicket($file, $user->id, 60);

        return response()->json([
            'success' => true,
            'ticket' => $ticket,
            'url' => "/api/v1/storage/file/{$file->id}?ticket=" . urlencode($ticket),
            'expiresIn' => 60,
        ]);
    }

    /**
     * Secure authenticated file streaming gate.
     * GET /api/v1/storage/file/{id}
     */
    public function streamFile(Request $request, string $id): Response
    {
        $cleanId = preg_replace('/\.[a-zA-Z0-9]+$/', '', $id);
        $user = $request->user();

        // 1. Check for short-lived HMAC ticket first
        if (! $user && $request->filled('ticket')) {
            $ticket = (string) $request->query('ticket');
            $ticketUserId = $this->storageService->verifyStreamingTicket($ticket, $cleanId)
                ?: $this->storageService->verifyStreamingTicket($ticket, $id);
            if ($ticketUserId) {
                $user = Profile::find($ticketUserId);
            }
        }

        // 2. Fallback check for Bearer token query string or Authorization header
        if (! $user && ($tokenString = ($request->query('token') ?: $request->bearerToken()))) {
            $rawToken = preg_replace('/^Bearer\s+/i', '', trim((string) $tokenString));
            $pat = \Laravel\Sanctum\PersonalAccessToken::findToken($rawToken);
            if ($pat) {
                $user = $pat->tokenable;
            }
        }

        // 3. Fetch master file record (by clean UUID or raw ID)
        $file = FileRecord::find($cleanId) ?: FileRecord::find($id);
        if (! $file) {
            return response()->json(['error' => 'File record not found.'], Response::HTTP_NOT_FOUND);
        }

        // Announcements are public banners visible on login / student board
        if ($file->type !== 'announcement') {
            if (! $user) {
                return response()->json(['error' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
            }

            if ($user->is_banned) {
                return response()->json(['error' => 'Account is deactivated.'], Response::HTTP_FORBIDDEN);
            }

            // 4. Strict Authorization gate: Clinic staff/nurses OR student owner
            if (! $this->isAuthorizedToAccessFile($user, $file)) {
                return response()->json([
                    'error' => 'Forbidden. You do not have permission to view this medical document.',
                ], Response::HTTP_FORBIDDEN);
            }
        }

        // 5. In-memory decryption from physical disk
        try {
            $plaintext = $this->storageService->readFile($file);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to stream secure file: ' . $e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        // 6. Audit log file access for Data Privacy compliance
        AuditLog::logAction('FILE_VIEW', $user?->id, $user?->role, null, $file->submission_id, $file->id, [
            'file_name' => $file->file_name,
            'category' => $file->type,
        ]);

        $safeName = preg_replace('/[^\p{L}\p{N}._-]/u', '_', basename(str_replace("\0", '', (string) $file->file_name)));

        $origin = $request->header('Origin');
        $responseHeaders = [
            'Content-Type' => $file->mime_type ?: 'application/octet-stream',
            'Content-Disposition' => "inline; filename=\"{$safeName}\"",
            'X-Content-Type-Options' => 'nosniff',
            'X-Download-Options' => 'noopen',
            'Cache-Control' => 'private, no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            'Cross-Origin-Resource-Policy' => 'same-origin',
            'X-Frame-Options' => 'SAMEORIGIN',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self' blob: data:; style-src 'unsafe-inline'; form-action 'none';",
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        ];

        if (! empty($file->file_hash)) {
            $responseHeaders['ETag'] = '"' . $file->file_hash . '"';
            $responseHeaders['X-File-SHA256'] = $file->file_hash;
        }

        if ($origin) {
            $responseHeaders['Access-Control-Allow-Origin'] = $origin;
            $responseHeaders['Access-Control-Allow-Credentials'] = 'true';
            $responseHeaders['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
        }

        return response($plaintext, Response::HTTP_OK, $responseHeaders);
    }
}

