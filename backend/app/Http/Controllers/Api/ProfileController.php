<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FileRecord;
use App\Models\Profile;
use App\Models\StaffUser;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function updateStudentProfile(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $data = $request->all();
        $studentId = $user->student_id ?: ($data['studentId'] ?? null);

        if ($user->role === 'student' && $user->student_id && isset($data['studentId']) && $data['studentId'] !== $user->student_id) {
            return response()->json(['error' => 'Forbidden. You cannot modify another student\'s profile.'], 403);
        }

        if (! $studentId) {
            return response()->json(['error' => 'Student ID is required.'], 400);
        }

        $student = Student::firstOrNew(['student_id' => $studentId]);
        $student->profile_id = $user->id;

        if (isset($data['firstName'])) $student->first_name = $data['firstName'];
        if (isset($data['lastName'])) $student->last_name = $data['lastName'];
        if (array_key_exists('middleInitial', $data)) $student->middle_initial = $data['middleInitial'];
        if (isset($data['department'])) $student->department = $data['department'];
        if (isset($data['course'])) $student->course = $data['course'];
        if (isset($data['yearLevel'])) {
            $year = is_numeric($data['yearLevel']) ? (int) $data['yearLevel'] : (int) filter_var($data['yearLevel'], FILTER_SANITIZE_NUMBER_INT);
            $student->year_level = $year ?: 1;
        }
        if (isset($data['age'])) $student->age = (int) $data['age'];
        if (isset($data['sex'])) $student->sex = $data['sex'];
        if (array_key_exists('birthday', $data)) {
            $student->birthday = !empty($data['birthday']) ? substr(trim($data['birthday']), 0, 10) : null;
        }
        if (isset($data['civilStatus'])) $student->civil_status = $data['civilStatus'];
        if (isset($data['contactNumber'])) $student->contact_number = $data['contactNumber'];
        if (isset($data['address'])) $student->address = $data['address'];

        $student->save();

        // Also sync profile fields
        if (isset($data['firstName'])) $user->first_name = $data['firstName'];
        if (isset($data['lastName'])) $user->last_name = $data['lastName'];
        if (isset($data['department'])) $user->department = $data['department'];
        if (isset($data['course'])) $user->course = $data['course'];
        $user->student_id = $studentId;
        $user->save();

        AuditLog::logAction('STUDENT_PROFILE_UPDATE', $user->id, $user->role, $studentId);

        return response()->json([
            'success' => true,
            'student' => $student,
        ]);
    }

    public function updateStaffProfile(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $data = $request->all();
        $staff = StaffUser::firstOrNew(['profile_id' => $user->id]);

        $staff->email = $user->email;
        if (isset($data['firstName'])) $staff->first_name = $data['firstName'];
        if (isset($data['lastName'])) $staff->last_name = $data['lastName'];
        if (array_key_exists('middleInitial', $data)) $staff->middle_initial = $data['middleInitial'];
        if (isset($data['position'])) $staff->position = $data['position'];
        if (isset($data['phone'])) $staff->phone = $data['phone'];

        $staff->save();

        // Sync profile names
        if (isset($data['firstName'])) $user->first_name = $data['firstName'];
        if (isset($data['lastName'])) $user->last_name = $data['lastName'];
        $user->save();

        AuditLog::logAction('STAFF_PROFILE_UPDATE', $user->id, $user->role);

        return response()->json([
            'success' => true,
            'profile' => [
                'id' => $user->id,
                'role' => $user->role,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'student_id' => $user->student_id,
                'department' => $user->department,
                'course' => $user->course,
                'password_setup_completed' => (bool) $user->password_setup_completed,
            ],
            'staff' => $staff,
        ]);
    }

    public function getStaffSignature(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $staff = StaffUser::where('profile_id', $user->id)->first();
        if (! $staff) {
            return response()->json([
                'signatureUrl' => null,
                'signatureFileName' => null,
            ]);
        }

        return response()->json([
            'signatureUrl' => $staff->signature_url,
            'signatureFileName' => $staff->signature_file_name,
        ]);
    }

    public function updateStaffSignature(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'signatureUrl' => ['required', 'string'],
            'fileName' => ['nullable', 'string'],
        ]);

        $staff = StaffUser::firstOrNew(['profile_id' => $user->id]);
        $staff->email = $user->email;
        $staff->first_name = $staff->first_name ?: ($user->first_name ?? '');
        $staff->last_name = $staff->last_name ?: ($user->last_name ?? '');
        $staff->signature_url = $validated['signatureUrl'];
        $staff->signature_file_name = $validated['fileName'] ?? null;
        $staff->save();

        AuditLog::logAction('STAFF_SIGNATURE_UPDATE', $user->id, $user->role);

        return response()->json([
            'success' => true,
            'signatureUrl' => $staff->signature_url,
        ]);
    }

    public function getStudentProfileAssets(Request $request): JsonResponse
    {
        /** @var Profile $user */
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $studentId = $request->query('studentId');
        if ($user->role === 'student') {
            // A student can NEVER access another student's photo or signature
            if (! empty($studentId) && $studentId !== $user->student_id) {
                return response()->json([
                    'error' => 'Forbidden. You do not have permission to access another student\'s profile image or signature.',
                ], 403);
            }
            $studentId = $user->student_id;
        } elseif (empty($studentId)) {
            $studentId = $user->student_id;
        }

        if (! $studentId) {
            return response()->json([
                'success' => false,
                'photo' => null,
                'signature' => null,
                'photoUrl' => null,
                'signatureUrl' => null,
                'photoFileName' => null,
                'signatureFileName' => null,
            ]);
        }

        $student = Student::where('student_id', $studentId)->first();
        $photoUrl = $student ? $student->profile_photo_url : null;
        $signatureUrl = $student ? $student->signature_url : null;
        $photoFileName = $student ? $student->profile_photo_file_name : null;
        $signatureFileName = $student ? $student->signature_file_name : null;

        return response()->json([
            'success' => true,
            'photoUrl' => $photoUrl,
            'signatureUrl' => $signatureUrl,
            'photoFileName' => $photoFileName,
            'signatureFileName' => $signatureFileName,
            'photo' => $photoUrl ? ['url' => $photoUrl] : null,
            'signature' => $signatureUrl ? ['url' => $signatureUrl] : null,
        ]);
    }
}
