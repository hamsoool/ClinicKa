<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::middleware('auth:sanctum')->get('/auth/v1/user', [\App\Http\Controllers\Api\AuthController::class, 'getUser']);
Route::post('/auth/v1/signup', [\App\Http\Controllers\Api\AuthController::class, 'signup']);
Route::post('/auth/v1/resend', [\App\Http\Controllers\Api\AuthController::class, 'resendVerification']);
Route::get('/auth/v1/verify', [\App\Http\Controllers\Api\AuthController::class, 'verifyEmail']);
Route::post('/auth/v1/verify', [\App\Http\Controllers\Api\AuthController::class, 'verifyEmail']);
Route::post('/auth/v1/token', [\App\Http\Controllers\Api\AuthController::class, 'login']);
Route::post('/auth/v1/recover', [\App\Http\Controllers\Api\AuthController::class, 'sendPasswordChangeOtp']);
Route::middleware('auth:sanctum')->post('/auth/v1/logout', [\App\Http\Controllers\Api\AuthController::class, 'logout']);
 
// Public announcement and static storage route
Route::get('/storage/file/{id}', [\App\Http\Controllers\Api\StorageController::class, 'streamFile']);
Route::get('/storage/{path}', function (string $path) {
    // Only allow public assets like announcements, strictly block directory traversal
    $cleanPath = ltrim(str_replace(['..', "\0"], '', $path), '/');
    $filePath = storage_path("app/public/{$cleanPath}");

    if (! file_exists($filePath)) {
        abort(404);
    }

    $mime = finfo_file(finfo_open(FILEINFO_MIME_TYPE), $filePath) ?: 'application/octet-stream';

    return response()->file($filePath, [
        'Content-Type' => $mime,
        'Cache-Control' => 'public, max-age=86400',
        'Cross-Origin-Resource-Policy' => 'cross-origin',
        'X-Content-Type-Options' => 'nosniff',
    ]);
})->where('path', '.*');
