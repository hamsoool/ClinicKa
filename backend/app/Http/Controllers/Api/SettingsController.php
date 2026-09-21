<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\OcrCallLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

class SettingsController extends Controller
{
    private const CLEARANCE_SIGNATORIES_KEY = 'clearance_signatories';

    public function getClearanceSignatories(): JsonResponse
    {
        $stored = SystemSetting::getVal(self::CLEARANCE_SIGNATORIES_KEY, '[]');
        $signatories = json_decode($stored ?: '[]', true);

        if (! is_array($signatories)) {
            $signatories = [];
        }

        return response()->json([
            'signatories' => array_values(array_filter($signatories, static fn ($value) => is_string($value) && trim($value) !== '')),
        ]);
    }

    public function addClearanceSignatory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
        ]);

        $name = trim($validated['name']);
        $stored = SystemSetting::getVal(self::CLEARANCE_SIGNATORIES_KEY, '[]');
        $signatories = json_decode($stored ?: '[]', true);
        $signatories = is_array($signatories) ? array_values(array_filter($signatories, 'is_string')) : [];

        $alreadyExists = collect($signatories)->contains(
            static fn (string $existing) => mb_strtolower(trim($existing)) === mb_strtolower($name),
        );

        if (! $alreadyExists) {
            $signatories[] = $name;
            SystemSetting::setVal(self::CLEARANCE_SIGNATORIES_KEY, json_encode(array_values($signatories)));
        }

        return response()->json([
            'name' => $name,
            'signatories' => array_values($signatories),
        ]);
    }

    public function getAcademicYear(): JsonResponse
    {
        $ay = SystemSetting::getVal('current_academic_year', 'SY 2025-2026');
        return response()->json(['academicYear' => $ay]);
    }

    public function getReportingTerm(): JsonResponse
    {
        $term = SystemSetting::getVal('reporting_term', '1st Semester');
        return response()->json(['reportingTerm' => $term]);
    }

    public function getSessionPolicy(): JsonResponse
    {
        $timeout = (int) SystemSetting::getVal('session_timeout_minutes', '60');
        return response()->json(['sessionTimeoutMinutes' => $timeout]);
    }

    public function getSystemSettings(): JsonResponse
    {
        return response()->json([
            'academicYear' => SystemSetting::getVal('current_academic_year', 'SY 2025-2026'),
            'ocrProvider' => SystemSetting::getVal('ocr_provider', env('OCR_PROVIDER', 'ocr-space')),
            'sessionTimeoutMinutes' => (int) SystemSetting::getVal('session_timeout_minutes', '60'),
            'reportingTerm' => SystemSetting::getVal('reporting_term', '1st Semester'),
            'allowStudentResubmission' => SystemSetting::getVal('allow_student_resubmission', 'true') === 'true',
            'smtpNotificationsEnabled' => SystemSetting::getVal('smtp_notifications_enabled', 'true') === 'true',
        ]);
    }

    public function sendSettingsChangeOtp(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $otp = (string) random_int(100000, 999999);
        $cacheKey = 'settings_otp_' . $user->id;
        Cache::put($cacheKey, $otp, now()->addMinutes(10));

        try {
            Mail::raw("Your ClinicKa system settings verification code is: {$otp}. It expires in 10 minutes.", function ($message) use ($user) {
                $message->to($user->email)->subject('ClinicKa Settings Change OTP');
            });
        } catch (\Throwable) {
            // Fallback for offline/local environments
        }

        return response()->json([
            'success' => true,
            'message' => 'OTP dispatched to administrator email.',
        ]);
    }

    public function updateSystemSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'otp' => ['required', 'string'],
            'settings' => ['required', 'array'],
        ]);

        $cacheKey = 'settings_otp_' . $user->id;
        $cachedOtp = Cache::get($cacheKey);

        if (! $cachedOtp || $cachedOtp !== $validated['otp']) {
            return response()->json(['error' => 'Invalid or expired OTP code.'], 422);
        }

        $settings = $validated['settings'];

        if (isset($settings['academicYear'])) {
            SystemSetting::setVal('current_academic_year', $settings['academicYear']);
        }
        if (isset($settings['ocrProvider'])) {
            SystemSetting::setVal('ocr_provider', $settings['ocrProvider']);
        }
        if (isset($settings['sessionTimeoutMinutes'])) {
            SystemSetting::setVal('session_timeout_minutes', (string) $settings['sessionTimeoutMinutes']);
        }
        if (isset($settings['reportingTerm'])) {
            SystemSetting::setVal('reporting_term', $settings['reportingTerm']);
        }
        if (isset($settings['allowStudentResubmission'])) {
            SystemSetting::setVal('allow_student_resubmission', $settings['allowStudentResubmission'] ? 'true' : 'false');
        }
        if (isset($settings['smtpNotificationsEnabled'])) {
            SystemSetting::setVal('smtp_notifications_enabled', $settings['smtpNotificationsEnabled'] ? 'true' : 'false');
        }

        Cache::forget($cacheKey);

        AuditLog::logAction('SETTINGS_UPDATE', $user->id, $user->role, null, null, null, [
            'updated_settings' => array_keys($settings),
        ]);

        return $this->getSystemSettings();
    }

    public function getOcrAnalytics(): JsonResponse
    {
        $azureCount = OcrCallLog::where('provider', 'azure')->count();
        $ocrSpaceCount = OcrCallLog::where('provider', 'ocr-space')->count();
        $totalCount = $azureCount + $ocrSpaceCount;

        return response()->json([
            'totalCalls' => $totalCount,
            'azureCalls' => $azureCount,
            'ocrSpaceCalls' => $ocrSpaceCount,
            'activeProvider' => SystemSetting::getVal('ocr_provider', env('OCR_PROVIDER', 'ocr-space')),
        ]);
    }
}
