<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected const GC_DOMAIN = 'gordoncollege.edu.ph';

    /**
     * Authenticate with email & password.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = trim(strtolower($validated['email']));
        $profile = Profile::where('email', $email)->first();

        if (! $profile || ! Hash::check($validated['password'], $profile->password_hash)) {
            return response()->json([
                'error' => 'Invalid email or password.',
            ], 401);
        }

        if ($profile->is_banned) {
            return response()->json([
                'error' => 'This account is not available. Contact the administrator for assistance.',
            ], 403);
        }

        // Enforce Gordon College domain restriction for students
        if ($profile->role === 'student' && ! str_ends_with($email, '@' . self::GC_DOMAIN)) {
            return response()->json([
                'error' => 'Only @' . self::GC_DOMAIN . ' email accounts are allowed for students.',
            ], 403);
        }

        // Create Sanctum personal access token
        $token = $profile->createToken('auth-token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => 86400,
            'refresh_token' => $token,
            'user' => [
                'id' => $profile->id,
                'email' => $profile->email,
                'role' => $profile->role,
                'user_metadata' => [
                    'full_name' => trim(($profile->first_name ?? '') . ' ' . ($profile->last_name ?? '')),
                    'role' => $profile->role,
                ],
            ],
            'profile' => [
                'id' => $profile->id,
                'role' => $profile->role,
                'email' => $profile->email,
                'first_name' => $profile->first_name,
                'last_name' => $profile->last_name,
                'student_id' => $profile->student_id,
                'department' => $profile->department,
                'course' => $profile->course,
                'password_setup_completed' => (bool) $profile->password_setup_completed,
            ],
        ]);
    }

    /**
     * Get the authenticated user profile.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->user();

        $profileData = [
            'id' => $profile->id,
            'role' => $profile->role,
            'email' => $profile->email,
            'first_name' => $profile->first_name,
            'last_name' => $profile->last_name,
            'student_id' => $profile->student_id,
            'department' => $profile->department,
            'course' => $profile->course,
            'password_setup_completed' => (bool) $profile->password_setup_completed,
        ];

        return response()->json([
            'profile' => $profileData,
            'student' => $profile->student,
            'staff' => $profile->staff,
            ...$profileData,
        ]);
    }

    /**
     * Supabase GoTrue compatibility endpoint: GET /auth/v1/user
     */
    public function getUser(Request $request): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->user();
        if (! $profile) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'id' => $profile->id,
            'aud' => 'authenticated',
            'role' => 'authenticated',
            'email' => $profile->email,
            'email_confirmed_at' => $profile->created_at?->toISOString() ?? now()->toISOString(),
            'phone' => '',
            'confirmed_at' => $profile->created_at?->toISOString() ?? now()->toISOString(),
            'last_sign_in_at' => now()->toISOString(),
            'app_metadata' => [
                'provider' => 'email',
                'providers' => ['email'],
                'role' => $profile->role,
            ],
            'user_metadata' => [
                'full_name' => trim(($profile->first_name ?? '') . ' ' . ($profile->last_name ?? '')),
                'role' => $profile->role,
                'student_id' => $profile->student_id,
            ],
            'identities' => [],
            'created_at' => $profile->created_at?->toISOString() ?? now()->toISOString(),
            'updated_at' => $profile->updated_at?->toISOString() ?? now()->toISOString(),
        ]);
    }

    /**
     * Log out and invalidate the current access token.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json(['success' => true]);
    }

    /**
     * Generate and dispatch a 6-digit password reset OTP.
     */
    public function sendPasswordChangeOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $email = trim(strtolower($validated['email']));
        $profile = Profile::where('email', $email)->first();

        if (! $profile) {
            // Return success to avoid email enumeration
            return response()->json(['success' => true]);
        }

        $otp = (string) random_int(100000, 999999);
        $cacheKey = 'password_otp_' . md5($email);
        Cache::put($cacheKey, [
            'otp' => $otp,
            'profile_id' => $profile->id,
        ], now()->addMinutes(10));

        // Send via mail if configured or log
        try {
            Mail::raw("Your ClinicKa verification code is: {$otp}. This code will expire in 10 minutes.", function ($message) use ($email) {
                $message->to($email)->subject('ClinicKa Password Verification Code');
            });
        } catch (\Throwable) {
            // Mail logging fallback
        }

        return response()->json([
            'success' => true,
            'message' => 'OTP dispatched successfully.',
        ]);
    }

    /**
     * Verify OTP and set a new password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'otp' => ['required', 'string', 'size:6'],
            'new_password' => ['required', 'string', 'min:8'],
        ]);

        $email = trim(strtolower($validated['email']));
        $cacheKey = 'password_otp_' . md5($email);
        $cached = Cache::get($cacheKey);

        if (! $cached || $cached['otp'] !== $validated['otp']) {
            return response()->json([
                'error' => 'Invalid or expired verification code.',
            ], 422);
        }

        $profile = Profile::find($cached['profile_id']);
        if (! $profile) {
            return response()->json(['error' => 'User profile not found.'], 404);
        }

        $profile->password_hash = Hash::make($validated['new_password']);
        $profile->password_setup_completed = true;
        $profile->save();

        Cache::forget($cacheKey);

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * Purge unauthorized non-GC Google registrations.
     */
    public function rejectGoogleAccount(Request $request): JsonResponse
    {
        $email = trim(strtolower($request->input('email', '')));
        if ($email && ! str_ends_with($email, '@' . self::GC_DOMAIN)) {
            Profile::where('email', $email)->where('role', 'student')->delete();
            return response()->json(['success' => true, 'deleted' => true]);
        }

        return response()->json(['success' => true, 'deleted' => false]);
    }

    /**
     * Supabase GoTrue compatibility endpoint: POST /auth/v1/signup
     */
    public function signup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $email = trim(strtolower($validated['email']));

        if (! str_ends_with($email, '@' . self::GC_DOMAIN)) {
            return response()->json([
                'error' => 'Please use your @' . self::GC_DOMAIN . ' email address to register.',
                'message' => 'Please use your @' . self::GC_DOMAIN . ' email address to register.',
            ], 422);
        }

        // Check if user already exists
        $existing = Profile::where('email', $email)->first();
        if ($existing && $existing->password_setup_completed) {
            return response()->json([
                'code' => 'user_already_exists',
                'error' => 'This email is already registered. Try signing in or reset your password.',
                'message' => 'This email is already registered. Try signing in or reset your password.',
                'identities' => [],
            ], 400);
        }

        $meta = $request->input('data', []);
        $firstName = trim($meta['first_name'] ?? '');
        $lastName = trim($meta['last_name'] ?? '');
        $fullName = trim($meta['full_name'] ?? "{$firstName} {$lastName}");
        $studentId = trim($meta['student_id'] ?? '');

        if (! $studentId && preg_match('/^(\d{9})@/', $email, $matches)) {
            $studentId = $matches[1];
        }

        $userId = $existing ? $existing->id : (string) Str::uuid();
        $token = bin2hex(random_bytes(32));

        $regData = [
            'id' => $userId,
            'email' => $email,
            'password_hash' => Hash::make($validated['password']),
            'first_name' => $firstName,
            'last_name' => $lastName,
            'full_name' => $fullName,
            'student_id' => $studentId,
            'token' => $token,
        ];

        Cache::put("email_verify_{$token}", $regData, now()->addHours(24));
        Cache::put('pending_email_reg_' . md5($email), $token, now()->addHours(24));

        $redirectTo = $request->input('options.emailRedirectTo')
            ?: $request->input('emailRedirectTo')
            ?: $request->query('redirect_to')
            ?: 'http://localhost:5173/auth?mode=signin&verified=1';

        $verifyUrl = url("/api/auth/v1/verify?token={$token}&type=signup&redirect_to=" . urlencode($redirectTo));

        try {
            Mail::raw(
                "Hello {$firstName},\n\nThank you for registering with ClinicKa!\nPlease confirm your email address by clicking the link below:\n\n{$verifyUrl}\n\nThis verification link will expire in 24 hours.\n\nIf you did not create an account, please disregard this email.",
                function ($message) use ($email) {
                    $message->to($email)->subject('ClinicKa Account Email Confirmation');
                }
            );
        } catch (\Throwable $e) {
            \Log::info("Email confirmation dispatched (fallback log for {$email}): {$verifyUrl} - Error: " . $e->getMessage());
        }

        return response()->json([
            'id' => $userId,
            'aud' => 'authenticated',
            'role' => 'authenticated',
            'email' => $email,
            'email_confirmed_at' => null,
            'phone' => '',
            'confirmation_sent_at' => now()->toIso8601String(),
            'app_metadata' => [
                'provider' => 'email',
                'providers' => ['email'],
            ],
            'user_metadata' => [
                'full_name' => $fullName,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'student_id' => $studentId,
            ],
            'identities' => [
                [
                    'id' => $userId,
                    'user_id' => $userId,
                    'identity_data' => ['email' => $email],
                    'provider' => 'email',
                    'created_at' => now()->toIso8601String(),
                    'updated_at' => now()->toIso8601String(),
                ],
            ],
            'created_at' => now()->toIso8601String(),
            'updated_at' => now()->toIso8601String(),
        ], 200);
    }

    /**
     * Supabase GoTrue compatibility endpoint: POST /auth/v1/resend
     */
    public function resendVerification(Request $request): JsonResponse
    {
        $email = trim(strtolower($request->input('email', '')));
        if (! $email) {
            return response()->json(['error' => 'Email is required.'], 422);
        }

        $existing = Profile::where('email', $email)->first();
        $cachedToken = Cache::get('pending_email_reg_' . md5($email));
        $regData = $cachedToken ? Cache::get("email_verify_{$cachedToken}") : null;

        if (! $regData && ! $existing) {
            return response()->json(['message' => 'Verification email sent if account exists.']);
        }

        $token = bin2hex(random_bytes(32));
        $name = $regData['first_name'] ?? ($existing ? $existing->first_name : 'Student');

        $dataToStore = $regData ?: [
            'id' => $existing->id,
            'email' => $existing->email,
            'password_hash' => $existing->password_hash,
            'first_name' => $existing->first_name,
            'last_name' => $existing->last_name,
            'full_name' => trim(($existing->first_name ?? '') . ' ' . ($existing->last_name ?? '')),
            'student_id' => $existing->student_id,
            'token' => $token,
        ];
        $dataToStore['token'] = $token;

        Cache::put("email_verify_{$token}", $dataToStore, now()->addHours(24));
        Cache::put('pending_email_reg_' . md5($email), $token, now()->addHours(24));

        $redirectTo = $request->input('options.emailRedirectTo')
            ?: $request->input('emailRedirectTo')
            ?: $request->query('redirect_to')
            ?: 'http://localhost:5173/auth?mode=signin&verified=1';

        $verifyUrl = url("/api/auth/v1/verify?token={$token}&type=signup&redirect_to=" . urlencode($redirectTo));

        try {
            Mail::raw(
                "Hello {$name},\n\nWe received a request to resend your ClinicKa account verification link.\nPlease confirm your email address by clicking the link below:\n\n{$verifyUrl}\n\nThis verification link will expire in 24 hours.\n\nIf you did not request this, please disregard this email.",
                function ($message) use ($email) {
                    $message->to($email)->subject('ClinicKa Account Email Confirmation');
                }
            );
        } catch (\Throwable $e) {
            \Log::info("Email confirmation resent (fallback log for {$email}): {$verifyUrl} - Error: " . $e->getMessage());
        }

        return response()->json(['message' => 'Verification email sent.']);
    }

    /**
     * Supabase GoTrue compatibility endpoint: GET /auth/v1/verify
     */
    public function verifyEmail(Request $request): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $token = $request->query('token') ?: $request->input('token');
        $type = $request->query('type') ?: $request->input('type', 'signup');
        $redirectTo = $request->query('redirect_to') ?: $request->input('redirect_to', 'http://localhost:5173/auth?mode=signin&verified=1');

        if (! $token) {
            if ($request->wantsJson()) {
                return response()->json(['error' => 'Verification token missing.'], 400);
            }
            return redirect($redirectTo . (str_contains($redirectTo, '?') ? '&' : '?') . 'error=missing_token');
        }

        $regData = Cache::get("email_verify_{$token}");

        if (! $regData) {
            if ($request->wantsJson()) {
                return response()->json(['error' => 'Invalid or expired verification link.'], 400);
            }
            return redirect($redirectTo . (str_contains($redirectTo, '?') ? '&' : '?') . 'error=expired_token');
        }

        $email = $regData['email'];
        $profile = Profile::where('email', $email)->first();

        if (! $profile) {
            $profile = Profile::create([
                'id' => $regData['id'] ?? (string) Str::uuid(),
                'email' => $email,
                'password_hash' => $regData['password_hash'],
                'role' => 'student',
                'first_name' => $regData['first_name'],
                'last_name' => $regData['last_name'],
                'student_id' => $regData['student_id'] ?? null,
                'password_setup_completed' => true,
            ]);
        } else {
            $profile->password_setup_completed = true;
            if (! empty($regData['password_hash'])) {
                $profile->password_hash = $regData['password_hash'];
            }
            $profile->save();
        }

        if ($profile->student_id) {
            Student::firstOrCreate(
                ['student_id' => $profile->student_id],
                [
                    'profile_id' => $profile->id,
                    'first_name' => $profile->first_name,
                    'last_name' => $profile->last_name,
                    'email' => $profile->email,
                    'academic_year' => 'SY 2025-2026',
                ]
            );
        }

        Cache::forget("email_verify_{$token}");
        Cache::forget('pending_email_reg_' . md5($email));

        AuditLog::logAction('EMAIL_VERIFIED', $profile->id, $profile->role, null, null, null, [
            'email' => $email,
        ]);

        if ($request->wantsJson() && ! $request->isMethod('get')) {
            return response()->json(['success' => true, 'message' => 'Email successfully confirmed.']);
        }

        $separator = str_contains($redirectTo, '?') ? '&' : '?';
        $finalUrl = str_contains($redirectTo, 'verified=') ? $redirectTo : "{$redirectTo}{$separator}verified=1";

        return redirect()->away($finalUrl);
    }
}
