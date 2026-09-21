<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArchivedAccount;
use App\Models\AuditLog;
use App\Models\MedicalHistory;
use App\Models\Profile;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    /**
     * GET /user-accounts
     */
    public function getUserAccounts(Request $request): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();

        $archivedUserIds = ArchivedAccount::pluck('user_id')->flip()->all();

        // Super administrators have higher role authority and should not be displayed or counted in general user accounts
        $profiles = Profile::with(['student', 'staff'])
            ->where('role', '!=', 'super_admin')
            ->orderBy('created_at', 'desc')
            ->get();

        $users = $profiles
            ->filter(fn ($p) => ! isset($archivedUserIds[$p->id]))
            ->map(function ($p) use ($currentUser) {
                $name = trim("{$p->first_name} {$p->last_name}")
                    ?: ($p->staff?->first_name ? trim("{$p->staff->first_name} {$p->staff->last_name}") : $p->email);

                $roleLabel = match ($p->role) {
                    'student' => 'Student',
                    'staff' => $p->staff?->position ?: 'Clinic Staff',
                    'doctor', 'physician' => 'Clinic Doctor',
                    'admin' => 'Administrator',
                    'super_admin' => 'Super Administrator',
                    default => ucfirst((string) $p->role),
                };

                // Permissions for canArchive:
                // - Superadmin can archive admin accounts (and student/staff/doctor accounts), except self.
                // - Admin accounts can archive student, staff, and doctor accounts (and CANNOT archive admin or super_admin).
                $canArchive = false;
                if ($currentUser && $p->id !== $currentUser->id) {
                    if ($currentUser->isSuperAdmin()) {
                        $canArchive = true;
                    } elseif ($currentUser->isAdmin()) {
                        $canArchive = in_array($p->role, ['student', 'staff', 'doctor', 'physician', 'nurse'], true);
                    }
                }

                return [
                    'userId' => $p->id,
                    'id' => $p->student_id ?: $p->id,
                    'name' => $name,
                    'email' => $p->email,
                    'role' => $roleLabel,
                    'roleKey' => $p->role,
                    'position' => $p->staff?->position,
                    'status' => $p->is_banned ? 'Inactive' : 'Active',
                    'lastActive' => $p->updated_at ? $p->updated_at->toIso8601String() : ($p->created_at ? $p->created_at->toIso8601String() : null),
                    'canArchive' => $canArchive,
                    'createdAt' => $p->created_at ? $p->created_at->toIso8601String() : null,
                    'student' => $p->student ? [
                        'yearLevel' => (string) $p->student->year_level,
                        'contactNumber' => $p->student->contact_number,
                        'civilStatus' => $p->student->civil_status,
                    ] : null,
                    'staff' => $p->staff ? [
                        'position' => $p->staff->position,
                        'phone' => $p->staff->phone,
                        'isActive' => (bool) $p->staff->is_active,
                    ] : null,
                ];
            })
            ->values();

        return response()->json(['users' => $users]);
    }

    /**
     * GET /staff-users
     */
    public function getStaffUsers(Request $request): JsonResponse
    {
        $profiles = Profile::with('staff')
            ->whereIn('role', ['staff', 'doctor', 'physician', 'nurse'])
            ->orderBy('first_name', 'asc')
            ->get();

        $staff = $profiles->map(function ($p) {
            $name = trim("{$p->first_name} {$p->last_name}")
                ?: ($p->staff?->first_name ? trim("{$p->staff->first_name} {$p->staff->last_name}") : $p->email);

            return [
                'id' => $p->staff?->id ?: $p->id,
                'userId' => $p->id,
                'name' => $name,
                'role' => $p->staff?->position ?: 'Clinic Staff',
                'status' => $p->is_banned ? 'Inactive' : 'Active',
                'email' => $p->email,
            ];
        })->values();

        return response()->json(['staff' => $staff]);
    }

    /**
     * GET /archived-accounts
     */
    public function getArchivedAccounts(Request $request): JsonResponse
    {
        $archived = ArchivedAccount::where('role', '!=', 'super_admin')
            ->orderBy('archived_at', 'desc')
            ->get();

        $users = $archived->map(function ($a) {
            $data = $a->original_profile_data ?? [];
            $firstName = $data['first_name'] ?? '';
            $lastName = $data['last_name'] ?? '';
            $name = trim("{$firstName} {$lastName}") ?: ($a->email ?: 'Archived User');

            $role = match ($a->role) {
                'student' => 'Student',
                'staff' => 'Clinic Staff',
                'doctor', 'physician' => 'Clinic Doctor',
                'admin' => 'Administrator',
                'super_admin' => 'Super Administrator',
                default => ucfirst((string) $a->role),
            };

            return [
                'archiveId' => $a->id,
                'userId' => $a->user_id,
                'id' => $data['student_id'] ?? $a->user_id,
                'name' => $name,
                'email' => $a->email,
                'role' => $role,
                'roleKey' => $a->role,
                'status' => 'Archived',
                'archivedAt' => $a->archived_at ? $a->archived_at->toIso8601String() : null,
                'archivedReason' => $data['archive_reason'] ?? $data['reason'] ?? '',
            ];
        });

        return response()->json(['users' => $users]);
    }

    /**
     * POST /admin/create-account
     */
    public function createAccount(Request $request): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        $validated = $request->validate([
            'email' => ['required', 'email', 'unique:profiles,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', 'in:student,staff,doctor,admin'],
            'firstName' => ['required', 'string'],
            'lastName' => ['required', 'string'],
            'studentId' => ['nullable', 'string'],
            'department' => ['nullable', 'string'],
            'course' => ['nullable', 'string'],
            'yearLevel' => ['nullable', 'integer'],
        ]);

        // Only Super Administrators can create Administrator accounts
        if ($validated['role'] === 'admin' && ! $currentUser->isSuperAdmin()) {
            return response()->json([
                'error' => 'Forbidden. Only Super Administrators can create Administrator accounts.',
            ], 403);
        }

        $profile = Profile::create([
            'email' => trim(strtolower($validated['email'])),
            'password_hash' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'first_name' => $validated['firstName'],
            'last_name' => $validated['lastName'],
            'student_id' => $validated['studentId'] ?? null,
            'department' => $validated['department'] ?? null,
            'course' => $validated['course'] ?? null,
            'password_setup_completed' => true,
            'is_banned' => false,
        ]);

        if ($validated['role'] === 'student' && ! empty($validated['studentId'])) {
            Student::create([
                'student_id' => $validated['studentId'],
                'profile_id' => $profile->id,
                'first_name' => $validated['firstName'],
                'last_name' => $validated['lastName'],
                'department' => $validated['department'] ?? 'CCS',
                'course' => $validated['course'] ?? '',
                'year_level' => $validated['yearLevel'] ?? 1,
            ]);
        } elseif (in_array($validated['role'], ['staff', 'doctor'], true)) {
            StaffUser::create([
                'profile_id' => $profile->id,
                'email' => $profile->email,
                'first_name' => $validated['firstName'],
                'last_name' => $validated['lastName'],
                'position' => $validated['role'] === 'doctor' ? 'Clinic Doctor' : 'Clinic Staff',
                'is_active' => true,
            ]);
        }

        AuditLog::logAction('CREATE_ACCOUNT', $currentUser?->id, $currentUser?->role, $validated['studentId'] ?? null, null, null, [
            'created_user_id' => $profile->id,
            'role' => $profile->role,
            'email' => $profile->email,
        ]);

        return response()->json([
            'success' => true,
            'userId' => $profile->id,
            'user' => $profile,
        ]);
    }

    /**
     * POST /admin/create-staff
     */
    public function createStaff(Request $request): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        $validated = $request->validate([
            'email' => ['required', 'email', 'unique:profiles,email'],
            'password' => ['required', 'string', 'min:8'],
            'firstName' => ['required', 'string'],
            'lastName' => ['required', 'string'],
            'middleInitial' => ['nullable', 'string'],
            'position' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
        ]);

        $isDoctor = str_contains(strtolower($validated['position'] ?? ''), 'doctor');

        $profile = Profile::create([
            'email' => trim(strtolower($validated['email'])),
            'password_hash' => Hash::make($validated['password']),
            'role' => $isDoctor ? 'doctor' : 'staff',
            'first_name' => $validated['firstName'],
            'last_name' => $validated['lastName'],
            'password_setup_completed' => true,
            'is_banned' => false,
        ]);

        $staff = StaffUser::create([
            'profile_id' => $profile->id,
            'email' => $profile->email,
            'first_name' => $validated['firstName'],
            'last_name' => $validated['lastName'],
            'middle_initial' => $validated['middleInitial'] ?? null,
            'position' => $validated['position'] ?? ($isDoctor ? 'Clinic Doctor' : 'Nurse'),
            'phone' => $validated['phone'] ?? null,
            'is_active' => true,
        ]);

        AuditLog::logAction('CREATE_STAFF', $currentUser?->id, $currentUser?->role, null, null, null, [
            'staff_profile_id' => $profile->id,
            'email' => $profile->email,
        ]);

        return response()->json([
            'success' => true,
            'userId' => $profile->id,
            'staff' => $staff,
        ]);
    }

    /**
     * POST /admin/archive-account
     */
    public function archiveAccount(Request $request): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        $validated = $request->validate([
            'userId' => ['required', 'string'],
            'reason' => ['nullable', 'string'],
        ]);

        $target = Profile::find($validated['userId']);
        if (! $target) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        // Prevent self-archiving
        if ($target->id === $currentUser->id) {
            return response()->json(['error' => 'You cannot archive your own account.'], 400);
        }

        // Role-based hierarchy enforcement:
        // 1. Target is Administrator or Super Administrator: Only Super Administrator can archive
        if ($target->isAdmin() || $target->isSuperAdmin()) {
            if (! $currentUser->isSuperAdmin()) {
                return response()->json([
                    'error' => 'Forbidden. Only Super Administrators can archive Administrator accounts.',
                ], 403);
            }
        } else {
            // 2. Target is Student, Staff, Doctor, Nurse: Administrators and Super Administrators can archive
            if (! $currentUser->isAdmin() && ! $currentUser->isSuperAdmin()) {
                return response()->json([
                    'error' => 'Forbidden. Only Administrators can archive user accounts.',
                ], 403);
            }
        }

        $profileData = $target->toArray();
        $profileData['archive_reason'] = $validated['reason'] ?? null;

        $archive = ArchivedAccount::updateOrCreate(
            ['user_id' => $target->id],
            [
                'email' => $target->email,
                'role' => $target->role,
                'original_profile_data' => $profileData,
                'archived_by' => $currentUser->id,
                'archived_at' => now(),
            ]
        );

        $target->is_banned = true;
        $target->save();

        // Invalidate all tokens for this user
        $target->tokens()->delete();

        AuditLog::logAction('ARCHIVE_ACCOUNT', $currentUser->id, $currentUser->role, $target->student_id, null, null, [
            'archived_user_id' => $target->id,
            'archive_id' => $archive->id,
            'target_role' => $target->role,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'archiveId' => $archive->id,
        ]);
    }

    /**
     * POST /super-admin/administrators/{userId}/archive
     */
    public function archiveAdminAccount(Request $request, string $userId): JsonResponse
    {
        $request->merge(['userId' => $userId]);
        return $this->archiveAccount($request);
    }

    /**
     * POST /admin/restore-account/{archiveId}
     * or /super-admin/administrators/{archiveId}/restore
     */
    public function restoreAccount(Request $request, string $archiveId): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        $archive = ArchivedAccount::find($archiveId);

        if (! $archive) {
            $archive = ArchivedAccount::where('user_id', $archiveId)->first();
        }

        if (! $archive) {
            return response()->json(['error' => 'Archive record not found.'], 404);
        }

        // If target was admin, only superadmin can restore
        if ($archive->role === 'admin' && ! $currentUser->isSuperAdmin()) {
            return response()->json([
                'error' => 'Forbidden. Only Super Administrators can restore Administrator accounts.',
            ], 403);
        }

        $profile = Profile::find($archive->user_id);
        if ($profile) {
            $profile->is_banned = false;
            $profile->save();
        }

        $archiveUserId = $archive->user_id;
        $archive->delete();

        AuditLog::logAction('RESTORE_ACCOUNT', $currentUser?->id, $currentUser?->role, $profile?->student_id, null, null, [
            'restored_user_id' => $archiveUserId,
            'archive_id' => $archiveId,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * DELETE /admin/archive-account/{archiveId}
     */
    public function deleteArchivedAccount(Request $request, string $archiveId): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        $archive = ArchivedAccount::find($archiveId);

        if (! $archive) {
            $archive = ArchivedAccount::where('user_id', $archiveId)->first();
        }

        if (! $archive) {
            return response()->json(['error' => 'Archive record not found.'], 404);
        }

        if ($archive->role === 'admin' && ! $currentUser->isSuperAdmin()) {
            return response()->json([
                'error' => 'Forbidden. Only Super Administrators can permanently delete Administrator archives.',
            ], 403);
        }

        $archive->delete();

        AuditLog::logAction('DELETE_ARCHIVE', $currentUser?->id, $currentUser?->role, null, null, null, [
            'archive_id' => $archiveId,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * GET /super-admin/administrators
     */
    public function getAdministrators(Request $request): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        if (! $currentUser || ! $currentUser->isSuperAdmin()) {
            return response()->json(['error' => 'Forbidden. Only Super Administrators can view administrators.'], 403);
        }

        $archivedAdmins = ArchivedAccount::where('role', 'admin')
            ->orderBy('archived_at', 'desc')
            ->get();

        $archivedUserIds = $archivedAdmins->pluck('user_id')->flip()->all();

        $admins = Profile::where('role', 'admin')
            ->orderBy('created_at', 'desc')
            ->get()
            ->filter(fn ($a) => ! isset($archivedUserIds[$a->id]));

        $adminList = $admins->map(function ($a) {
            $name = trim("{$a->first_name} {$a->last_name}") ?: $a->email;
            return [
                'userId' => $a->id,
                'id' => $a->id,
                'name' => $name,
                'email' => $a->email,
                'role' => 'Administrator',
                'roleKey' => 'admin',
                'status' => $a->is_banned ? 'Inactive' : 'Active',
                'createdAt' => $a->created_at ? $a->created_at->toIso8601String() : null,
                'lastActive' => $a->updated_at ? $a->updated_at->toIso8601String() : ($a->created_at ? $a->created_at->toIso8601String() : null),
            ];
        })->values();

        $archivedList = $archivedAdmins->map(function ($arch) {
            $data = $arch->original_profile_data ?? [];
            $name = trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? ''))
                ?: ($arch->email ?: 'Archived Administrator');

            return [
                'archiveId' => $arch->id,
                'userId' => $arch->user_id,
                'id' => $arch->user_id,
                'name' => $name,
                'email' => $arch->email,
                'role' => 'Administrator',
                'roleKey' => 'admin',
                'status' => 'Archived',
                'archivedAt' => $arch->archived_at ? $arch->archived_at->toIso8601String() : null,
                'archivedReason' => $data['archive_reason'] ?? '',
            ];
        })->values();

        return response()->json([
            'administrators' => $adminList,
            'archivedAdministrators' => $archivedList,
        ]);
    }

    /**
     * POST /super-admin/administrators
     */
    public function createAdministrator(Request $request): JsonResponse
    {
        /** @var Profile $currentUser */
        $currentUser = $request->user();
        $validated = $request->validate([
            'email' => ['required', 'email', 'unique:profiles,email'],
            'password' => ['required', 'string', 'min:8'],
            'firstName' => ['required', 'string'],
            'lastName' => ['required', 'string'],
        ]);

        $admin = Profile::create([
            'email' => trim(strtolower($validated['email'])),
            'password_hash' => Hash::make($validated['password']),
            'role' => 'admin',
            'first_name' => $validated['firstName'],
            'last_name' => $validated['lastName'],
            'password_setup_completed' => true,
            'is_banned' => false,
        ]);

        AuditLog::logAction('CREATE_ADMIN', $currentUser->id, $currentUser->role, null, null, null, [
            'new_admin_id' => $admin->id,
            'email' => $admin->email,
        ]);

        return response()->json([
            'success' => true,
            'administrator' => $admin,
        ]);
    }

    /**
     * GET /analytics
     */
    public function getAnalytics(Request $request): JsonResponse
    {
        $totalStudents = Student::count();
        $totalSubmissions = Submission::count();
        $approvedCount = Submission::where('status', 'approved')->count();
        $pendingCount = Submission::where('status', 'pending')->count();
        $inReviewCount = Submission::where('status', 'in_review')->count();
        $returnedCount = Submission::where('status', 'returned')->count();

        // By department
        $departments = ['CCS', 'CBA', 'CEAS', 'CHTM', 'CAHS'];
        $byDepartment = [];
        foreach ($departments as $d) {
            $byDepartment[$d] = [
                'total' => Submission::where('department', $d)->count(),
                'approved' => Submission::where('department', $d)->where('status', 'approved')->count(),
                'pending' => Submission::where('department', $d)->where('status', 'pending')->count(),
                'returned' => Submission::where('department', $d)->where('status', 'returned')->count(),
            ];
        }

        // Top health conditions from medical_history
        $healthConditions = [
            'asthma' => MedicalHistory::where('asthma', true)->count(),
            'allergy' => MedicalHistory::where('allergy', true)->count(),
            'hypertension' => MedicalHistory::where('hypertension', true)->count(),
            'diabetes' => MedicalHistory::where('diabetes', true)->count(),
            'anxietyDisorder' => MedicalHistory::where('anxiety_disorder', true)->count(),
            'heartDisorder' => MedicalHistory::where('heart_disorder', true)->count(),
            'pneumonia' => MedicalHistory::where('pneumonia', true)->count(),
            'ptbPrimaryComplex' => MedicalHistory::where('ptb_primary_complex', true)->count(),
        ];

        return response()->json([
            'totalStudents' => $totalStudents,
            'totalSubmissions' => $totalSubmissions,
            'pendingRecords' => $pendingCount + $inReviewCount,
            'approvedRecords' => $approvedCount,
            'returnedRecords' => $returnedCount,
            'pendingCount' => $pendingCount,
            'inReviewCount' => $inReviewCount,
            'approvedCount' => $approvedCount,
            'returnedCount' => $returnedCount,
            'byDepartment' => $byDepartment,
            'healthConditions' => $healthConditions,
            'generatedAt' => now()->toIso8601String(),
        ]);
    }

    /**
     * POST /invalidate-cache
     */
    public function invalidateCache(Request $request): JsonResponse
    {
        Cache::forget('student_published_announcements');
        Cache::forget('sys_setting_current_academic_year');
        Cache::forget('sys_setting_reporting_term');
        Cache::forget('sys_setting_session_timeout_minutes');
        Cache::forget('sys_setting_ocr_provider');
        Cache::forget('sys_setting_allow_student_resubmission');
        Cache::forget('sys_setting_smtp_notifications_enabled');

        $studentId = $request->input('studentId');
        if ($studentId) {
            Cache::forget("student_records_{$studentId}");
            Cache::forget("student_profile_{$studentId}");
        }

        return response()->json(['success' => true, 'message' => 'Caches cleared.']);
    }
}
