<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Models\Student;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $isSuperAdmin = $user?->isSuperAdmin() === true;

        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'actor_name' => ['nullable', 'string', 'max:120'],
            'actor_role' => ['nullable', 'string', 'max:40'],
            'action' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:40'],
            'result' => ['nullable', 'in:SUCCESS,DENIED,FAILURE'],
            'student_name' => ['nullable', 'string', 'max:120'],
            'target_id' => ['nullable', 'string', 'max:191'],
        ]);

        $query = AuditLog::query()->latest('created_at');

        // Admins receive operational accountability only; security-system events
        // remain restricted to the super-admin audit surface.
        if (! $isSuperAdmin) {
            $query->whereIn('category', ['medical_record', 'medical_document', 'clearance', 'announcement', 'profile', 'ocr']);
        }

        $query
            ->when($validated['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', $from))
            ->when($validated['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<=', $to))
            ->when($validated['actor_name'] ?? null, function ($q, string $name) {
                $needle = '%' . addcslashes($name, '%_\\') . '%';
                $q->whereIn('actor_user_id', Profile::query()
                    ->select('id')
                    ->where(function ($profileQuery) use ($needle) {
                        $profileQuery
                            ->where('first_name', 'like', $needle)
                            ->orWhere('last_name', 'like', $needle)
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$needle])
                            ->orWhere('email', 'like', $needle);
                    }));
            })
            ->when($validated['actor_role'] ?? null, fn ($q, $role) => $q->where('actor_role', $role))
            ->when($validated['action'] ?? null, fn ($q, $action) => $q->where('action', strtoupper($action)))
            ->when($validated['category'] ?? null, fn ($q, $category) => $q->where('category', $category))
            ->when($validated['result'] ?? null, fn ($q, $result) => $q->where('result', $result))
            ->when($validated['student_name'] ?? null, function ($q, string $name) {
                $needle = '%' . addcslashes($name, '%_\\') . '%';
                $q->whereIn('student_id', Student::query()
                    ->select('student_id')
                    ->where(function ($studentQuery) use ($needle) {
                        $studentQuery
                            ->where('first_name', 'like', $needle)
                            ->orWhere('last_name', 'like', $needle)
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$needle]);
                    }));
            })
            ->when($validated['target_id'] ?? null, fn ($q, $targetId) => $q->where('target_id', $targetId));

        $page = $query->paginate((int) ($validated['per_page'] ?? 25));
        $actorIds = collect($page->items())->pluck('actor_user_id')->filter()->unique();
        $actors = Profile::whereIn('id', $actorIds)->get()->keyBy('id');

        return response()->json([
            'data' => collect($page->items())->map(fn (AuditLog $log) => $this->present($log, $actors->get($log->actor_user_id)))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function studentHistory(Request $request, string $studentId): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        $clinicalRoles = ['staff', 'doctor', 'nurse', 'physician', 'clinic_doctor'];
        $isAuthorized = in_array($user?->role, $clinicalRoles, true)
            || ($user?->role === 'student' && $user->student_id === $studentId);

        if (! $isAuthorized) {
            app(AuditService::class)->recordDenied('VIEW_RECORD_ACTIVITY', 'Student record activity access denied.', [
                'target_type' => 'student',
                'target_id' => $studentId,
                'student_id' => $studentId,
            ], $request);

            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $logs = AuditLog::query()
            ->where('student_id', $studentId)
            ->whereIn('category', ['medical_record', 'medical_document', 'clearance'])
            ->latest('created_at')
            ->limit(50)
            ->get();

        $actorIds = $logs->pluck('actor_user_id')->filter()->unique();
        $actors = Profile::whereIn('id', $actorIds)->get()->keyBy('id');

        return response()->json([
            'data' => $logs->map(fn (AuditLog $log) => $this->present($log, $actors->get($log->actor_user_id), false))->values(),
        ]);
    }

    private function present(AuditLog $log, ?Profile $actor, bool $includeSensitiveContext = true): array
    {
        $data = [
            'id' => $log->id,
            'actor' => $actor ? trim(($actor->first_name ?? '') . ' ' . ($actor->last_name ?? '')) ?: $actor->email : 'System',
            'actorRole' => $log->actor_role,
            'action' => $log->action,
            'category' => $log->category,
            'targetType' => $log->target_type,
            'targetId' => $log->target_id,
            'studentId' => $log->student_id,
            'result' => $log->result,
            'reason' => $log->reason,
            'createdAt' => $log->created_at?->toIso8601String(),
        ];

        if ($includeSensitiveContext) {
            $data['ipAddress'] = $log->ip_address;
            $data['userAgent'] = $log->user_agent;
            $data['metadata'] = $log->metadata;
        }

        return $data;
    }
}