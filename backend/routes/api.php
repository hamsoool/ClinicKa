<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CertificateController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OcrController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StorageController;
use App\Http\Controllers\Api\SubmissionController;
use Illuminate\Support\Facades\Route;

// Health Check
Route::get('/health', fn () => response()->json(['status' => 'ok', 'service' => 'ClinicKa API']));

$registerApiRoutes = function () {
    // -------------------------------------------------------------------------
    // Public System & Settings Information
    // -------------------------------------------------------------------------
    Route::get('/academic-year', [SettingsController::class, 'getAcademicYear']);
    Route::get('/reporting-term', [SettingsController::class, 'getReportingTerm']);
    Route::get('/session-policy', [SettingsController::class, 'getSessionPolicy']);
    Route::get('/student-announcements', [AnnouncementController::class, 'index']);
    Route::get('/storage/file/{id}', [StorageController::class, 'streamFile'])->where('id', '.*');

    // -------------------------------------------------------------------------
    // Public Authentication Endpoints
    // -------------------------------------------------------------------------
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
    Route::post('/auth/send-password-change-otp', [AuthController::class, 'sendPasswordChangeOtp'])->middleware('throttle:otp-requests');
    Route::post('/auth/change-password', [AuthController::class, 'changePassword'])->middleware('throttle:auth-login');
    Route::post('/auth/reject-google-account', [AuthController::class, 'rejectGoogleAccount']);

    // GoTrue Auth & Email Confirmation
    Route::post('/auth/v1/signup', [AuthController::class, 'signup'])->middleware('throttle:auth-login');
    Route::post('/auth/v1/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:otp-requests');
    Route::get('/auth/v1/verify', [AuthController::class, 'verifyEmail']);
    Route::post('/auth/v1/verify', [AuthController::class, 'verifyEmail']);

    // -------------------------------------------------------------------------
    // Authenticated Endpoints (Sanctum)
    // -------------------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function () {
        // Identity & Session
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Profile Management
        Route::put('/student-profile', [ProfileController::class, 'updateStudentProfile']);
        Route::put('/staff-profile', [ProfileController::class, 'updateStaffProfile']);
        Route::get('/staff-signature', [ProfileController::class, 'getStaffSignature']);
        Route::post('/staff-signature', [ProfileController::class, 'updateStaffSignature']);
        Route::get('/student-profile-assets', [ProfileController::class, 'getStudentProfileAssets']);

        // Storage & Upload Subsystem (Rate Limited)
        Route::post('/storage/upload', [StorageController::class, 'upload'])->middleware('throttle:storage-upload');
        Route::get('/storage/ticket/{id}', [StorageController::class, 'createStreamingTicket'])->where('id', '.*');
        Route::post('/upload-file', [StorageController::class, 'upload'])->middleware('throttle:storage-upload');
        Route::post('/upload-file/prepare', [StorageController::class, 'prepareUpload']);
        Route::post('/upload-file/complete', [StorageController::class, 'completeUpload'])->middleware('throttle:storage-upload');
        Route::post('/student-profile-asset/prepare', [StorageController::class, 'prepareUpload']);
        Route::post('/student-profile-asset/complete', [StorageController::class, 'completeUpload'])->middleware('throttle:storage-upload');
        Route::post('/student-profile-asset', [StorageController::class, 'upload'])->middleware('throttle:storage-upload');
        Route::post('/staff-signature/prepare', [StorageController::class, 'prepareUpload']);
        Route::post('/staff-signature/complete', [StorageController::class, 'completeUpload'])->middleware('throttle:storage-upload');
        Route::post('/announcement-image/prepare', [StorageController::class, 'prepareUpload']);
        Route::post('/announcement-image/complete', [StorageController::class, 'completeUpload'])->middleware('throttle:storage-upload');

        // Student Submissions
        Route::post('/submit-record', [SubmissionController::class, 'submitRecord']);
        Route::get('/student-records', [SubmissionController::class, 'getStudentRecords']);
        Route::get('/student-records/{studentId}', [SubmissionController::class, 'getStudentRecords']);
        Route::get('/submissions', [SubmissionController::class, 'getAllSubmissions']);
        Route::get('/submission/{id}', [SubmissionController::class, 'getSubmission']);

        // Notifications
        Route::get('/student-notifications', [NotificationController::class, 'getNotifications']);
        Route::get('/student-notifications/state', [NotificationController::class, 'getState']);
        Route::put('/student-notifications/state', [NotificationController::class, 'updateState']);
        Route::post('/student-notifications/sync', [NotificationController::class, 'syncNotifications']);
        Route::post('/student-notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
        Route::patch('/student-notifications/{id}', [NotificationController::class, 'updateNotification']);
        Route::delete('/student-notifications/{id}', [NotificationController::class, 'deleteNotification']);
        Route::post('/student-notifications/clear', [NotificationController::class, 'clearNotifications']);
        Route::post('/notifications/status-email', [NotificationController::class, 'sendStatusEmail']);
        Route::post('/invalidate-cache', [AdminController::class, 'invalidateCache']);

        // ---------------------------------------------------------------------
        // Staff, Doctor, Admin, & Super Admin Routes
        // ---------------------------------------------------------------------
        Route::middleware('role:staff,doctor,admin,super_admin')->group(function () {
            Route::get('/staff/dashboard-overview', [SubmissionController::class, 'getDashboardOverview']);
            Route::get('/staff/submission-summaries', [SubmissionController::class, 'getSubmissionSummaries']);
            Route::get('/staff/submission-report-summaries', [SubmissionController::class, 'getSubmissionReportSummaries']);
            Route::get('/staff/approved-students', [SubmissionController::class, 'getApprovedStudents']);
            Route::put('/submission/{id}/status', [SubmissionController::class, 'updateStatus']);
            Route::put('/submission/{id}/measurements', [SubmissionController::class, 'updateMeasurements']);

            // Certificate Issuance
            Route::post('/issue-certificate', [CertificateController::class, 'issueCertificate']);
            Route::get('/staff/certificate-records/{studentId}', [CertificateController::class, 'getStudentCertificates']);

            // OCR Operations (Rate Limited)
            Route::post('/submission/{id}/chest-xray-ocr', [OcrController::class, 'parseChestXray'])->middleware('throttle:ocr-operations');
            Route::post('/submission/{id}/cbc-ocr', [OcrController::class, 'parseCbc'])->middleware('throttle:ocr-operations');
            Route::post('/submission/{id}/urinalysis-ocr', [OcrController::class, 'parseUrinalysis'])->middleware('throttle:ocr-operations');

            // Announcements Management
            Route::get('/announcements', [AnnouncementController::class, 'adminIndex']);
            Route::post('/announcements', [AnnouncementController::class, 'store']);
            Route::put('/announcements/{id}', [AnnouncementController::class, 'update']);
            Route::patch('/announcements/{id}', [AnnouncementController::class, 'update']);
            Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

            // Analytics & Summary Metrics
            Route::get('/analytics', [AdminController::class, 'getAnalytics']);
        });

        // ---------------------------------------------------------------------
        // Administrator Routes
        // ---------------------------------------------------------------------
        Route::middleware('role:admin,super_admin')->group(function () {
            Route::get('/admin/system-settings', [SettingsController::class, 'getSystemSettings']);
            Route::post('/admin/send-settings-change-otp', [SettingsController::class, 'sendSettingsChangeOtp'])->middleware('throttle:otp-requests');
            Route::match(['post', 'put'], '/admin/system-settings', [SettingsController::class, 'updateSystemSettings']);
            Route::get('/admin/ocr-analytics', [SettingsController::class, 'getOcrAnalytics']);
            Route::get('/user-accounts', [AdminController::class, 'getUserAccounts']);
            Route::get('/staff-users', [AdminController::class, 'getStaffUsers']);
            Route::get('/archived-accounts', [AdminController::class, 'getArchivedAccounts']);
            Route::post('/admin/create-account', [AdminController::class, 'createAccount']);
            Route::post('/admin/create-staff', [AdminController::class, 'createStaff']);
            Route::post('/admin/archive-account', [AdminController::class, 'archiveAccount']);
            Route::delete('/admin/archive-account/{archiveId}', [AdminController::class, 'deleteArchivedAccount']);
            Route::post('/admin/restore-account/{archiveId}', [AdminController::class, 'restoreAccount']);
        });

        // ---------------------------------------------------------------------
        // Super Administrator Routes
        // ---------------------------------------------------------------------
        Route::middleware('role:super_admin')->group(function () {
            Route::get('/super-admin/administrators', [AdminController::class, 'getAdministrators']);
            Route::post('/super-admin/send-create-admin-otp', [AdminController::class, 'sendCreateAdminOtp'])->middleware('throttle:otp-requests');
            Route::post('/super-admin/administrators', [AdminController::class, 'createAdministrator']);
            Route::post('/super-admin/administrators/{userId}/archive', [AdminController::class, 'archiveAdminAccount']);
            Route::post('/super-admin/administrators/{archiveId}/restore', [AdminController::class, 'restoreAccount']);
            Route::delete('/super-admin/administrators/{archiveId}', [AdminController::class, 'deleteArchivedAccount']);
        });
    });
};

// Register under both /v1 and /functions/v1/server for dual frontend compatibility
Route::prefix('v1')->group($registerApiRoutes);
Route::prefix('functions/v1/server')->group($registerApiRoutes);

// PostgREST compatibility route for seamless fallback query support
Route::any('/rest/v1/{table}', [\App\Http\Controllers\Api\PostgrestCompatController::class, 'handle']);

// GoTrue compatibility route for Supabase JS client (resolves /api/auth/v1/user, signup, resend, verify, token, recover, logout)
Route::post('/auth/v1/signup', [AuthController::class, 'signup'])->middleware('throttle:auth-login');
Route::post('/auth/v1/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:otp-requests');
Route::get('/auth/v1/verify', [AuthController::class, 'verifyEmail']);
Route::post('/auth/v1/verify', [AuthController::class, 'verifyEmail']);
Route::post('/auth/v1/token', [AuthController::class, 'login'])->middleware('throttle:auth-login');
Route::post('/auth/v1/recover', [AuthController::class, 'sendPasswordChangeOtp'])->middleware('throttle:otp-requests');
Route::middleware('auth:sanctum')->post('/auth/v1/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->get('/auth/v1/user', [AuthController::class, 'getUser']);

// Direct storage streaming routes (supports /api/storage/file/{id} with or without /v1)
Route::get('/storage/file/{id}', [StorageController::class, 'streamFile'])->where('id', '.*');
Route::middleware('auth:sanctum')->get('/storage/ticket/{id}', [StorageController::class, 'createStreamingTicket'])->where('id', '.*');

