<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AnnouncementController extends Controller
{
    /**
     * GET /student-announcements or /announcements/published
     * Public and student view: published announcements only.
     */
    public function index(): JsonResponse
    {
        $announcements = Cache::remember('student_published_announcements', 300, function () {
            return Announcement::where('is_published', true)
                ->orderByDesc('date_posted')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($a) => [
                    'id' => $a->id,
                    'title' => $a->title,
                    'description' => $a->description,
                    'datePosted' => $a->date_posted ? $a->date_posted->format('Y-m-d') : null,
                    'date_posted' => $a->date_posted ? $a->date_posted->format('Y-m-d') : null,
                    'imagePath' => $a->image_path,
                    'image_path' => $a->image_path,
                    'imageUrl' => $a->image_path,
                    'image_url' => $a->image_path,
                    'isPublished' => (bool) $a->is_published,
                    'is_published' => (bool) $a->is_published,
                    'createdAt' => $a->created_at ? $a->created_at->toIso8601String() : null,
                ])
                ->all();
        });

        return response()->json([
            'announcements' => $announcements,
        ]);
    }

    /**
     * GET /announcements
     * Administrative management view: all announcements including unpublished drafts.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if ($user && ! $user->isStaff()) {
            return response()->json(['error' => 'Forbidden. Only clinic staff, doctors, and admins can manage announcements.'], 403);
        }

        $announcements = Announcement::orderByDesc('date_posted')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'title' => $a->title,
                'description' => $a->description,
                'datePosted' => $a->date_posted ? $a->date_posted->format('Y-m-d') : null,
                'date_posted' => $a->date_posted ? $a->date_posted->format('Y-m-d') : null,
                'imagePath' => $a->image_path,
                'image_path' => $a->image_path,
                'imageUrl' => $a->image_path,
                'image_url' => $a->image_path,
                'isPublished' => (bool) $a->is_published,
                'is_published' => (bool) $a->is_published,
                'createdBy' => $a->created_by,
                'created_by' => $a->created_by,
                'createdAt' => $a->created_at ? $a->created_at->toIso8601String() : null,
                'updatedAt' => $a->updated_at ? $a->updated_at->toIso8601String() : null,
            ]);

        return response()->json([
            'announcements' => $announcements,
        ]);
    }

    /**
     * POST /announcements
     */
    public function store(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if ($user && ! $user->isStaff()) {
            return response()->json(['error' => 'Forbidden. Only clinic staff, doctors, and admins can create announcements.'], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'datePosted' => ['nullable', 'date'],
            'date_posted' => ['nullable', 'date'],
            'imagePath' => ['nullable', 'string'],
            'image_path' => ['nullable', 'string'],
            'isPublished' => ['nullable', 'boolean'],
            'is_published' => ['nullable', 'boolean'],
        ]);

        $announcement = Announcement::create([
            'title' => $validated['title'],
            'description' => $validated['description'],
            'date_posted' => $validated['datePosted'] ?? $validated['date_posted'] ?? now()->toDateString(),
            'image_path' => $validated['imagePath'] ?? $validated['image_path'] ?? null,
            'is_published' => $validated['isPublished'] ?? $validated['is_published'] ?? true,
            'created_by' => $user ? $user->id : null,
        ]);

        Cache::forget('student_published_announcements');

        AuditLog::logAction('ANNOUNCEMENT_CREATE', $user?->id, $user?->role, null, null, null, [
            'announcement_id' => $announcement->id,
            'title' => $announcement->title,
        ]);

        return response()->json([
            'success' => true,
            'announcement' => $announcement,
        ], 201);
    }

    /**
     * PUT or PATCH /announcements/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if ($user && ! $user->isStaff()) {
            return response()->json(['error' => 'Forbidden. Only clinic staff, doctors, and admins can update announcements.'], 403);
        }

        $announcement = Announcement::find($id);
        if (! $announcement) {
            return response()->json(['error' => 'Announcement not found.'], 404);
        }

        $data = $request->all();
        if (isset($data['title'])) $announcement->title = $data['title'];
        if (isset($data['description'])) $announcement->description = $data['description'];
        if (isset($data['datePosted']) || isset($data['date_posted'])) {
            $announcement->date_posted = $data['datePosted'] ?? $data['date_posted'];
        }
        if (array_key_exists('imagePath', $data) || array_key_exists('image_path', $data)) {
            $announcement->image_path = $data['imagePath'] ?? $data['image_path'] ?? null;
        }
        if (isset($data['isPublished']) || isset($data['is_published'])) {
            $announcement->is_published = (bool) ($data['isPublished'] ?? $data['is_published']);
        }

        $announcement->save();
        Cache::forget('student_published_announcements');

        AuditLog::logAction('ANNOUNCEMENT_UPDATE', $user?->id, $user?->role, null, null, null, [
            'announcement_id' => $announcement->id,
            'title' => $announcement->title,
        ]);

        return response()->json([
            'success' => true,
            'announcement' => $announcement,
        ]);
    }

    /**
     * DELETE /announcements/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if ($user && ! $user->isStaff()) {
            return response()->json(['error' => 'Forbidden. Only clinic staff, doctors, and admins can delete announcements.'], 403);
        }

        $announcement = Announcement::find($id);

        if ($announcement) {
            $announcement->delete();
            Cache::forget('student_published_announcements');
            AuditLog::logAction('ANNOUNCEMENT_DELETE', $user?->id, $user?->role, null, null, null, [
                'announcement_id' => $id,
            ]);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Stream public announcement banner/image.
     * GET /api/storage/announcements/{filename}
     */
    public function streamAnnouncementImage(Request $request, string $filename): \Symfony\Component\HttpFoundation\Response
    {
        $origin = $request->header('Origin');
        if ($request->isMethod('OPTIONS')) {
            return response('', 204, [
                'Access-Control-Allow-Origin' => $origin ?: '*',
                'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers' => 'Authorization, Content-Type, X-Requested-With, Range',
                'Access-Control-Allow-Credentials' => $origin ? 'true' : 'false',
                'Cross-Origin-Resource-Policy' => 'cross-origin',
            ]);
        }

        $cleanFilename = basename(str_replace("\0", '', $filename));
        $filePath = storage_path("app/public/announcements/{$cleanFilename}");

        if (! file_exists($filePath)) {
            $cleanId = preg_replace('/\.[a-zA-Z0-9]+$/', '', $cleanFilename);
            $file = \App\Models\FileRecord::find($cleanId);
            if ($file) {
                $candidatePath = storage_path('app/' . ltrim((string) $file->storage_path, '/\\'));
                if (file_exists($candidatePath)) {
                    $filePath = $candidatePath;
                } else {
                    $candidatePublic = storage_path('app/public/' . ltrim((string) $file->storage_path, '/\\'));
                    if (file_exists($candidatePublic)) {
                        $filePath = $candidatePublic;
                    }
                }
            }
        }

        if (! file_exists($filePath)) {
            abort(404, 'Announcement image not found.');
        }

        $mime = finfo_file(finfo_open(FILEINFO_MIME_TYPE), $filePath) ?: 'image/jpeg';

        return response()->file($filePath, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=86400',
            'Cross-Origin-Resource-Policy' => 'cross-origin',
            'Access-Control-Allow-Origin' => $origin ?: '*',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
