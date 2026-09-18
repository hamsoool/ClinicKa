<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 1. General API rate limiter (120 req/min)
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        // 2. Strict Authentication Rate Limiter (5 attempts per minute)
        RateLimiter::for('auth-login', function (Request $request) {
            $email = (string) $request->input('email', '');
            $key = 'login:' . $request->ip() . '|' . strtolower($email);
            return Limit::perMinute(5)->by($key)->response(function () {
                return response()->json([
                    'error' => 'Too many login attempts. Please wait 1 minute before trying again.',
                ], 429);
            });
        });

        // 3. OTP Dispatch Rate Limiter (3 requests per 5 minutes)
        RateLimiter::for('otp-requests', function (Request $request) {
            $key = 'otp:' . $request->ip() . '|' . ($request->user()?->id ?: $request->input('email', 'guest'));
            return Limit::perMinutes(5, 3)->by($key)->response(function () {
                return response()->json([
                    'error' => 'Too many OTP requests. Please wait 5 minutes before requesting another code.',
                ], 429);
            });
        });

        // 4. Medical Storage Upload Rate Limiter (20 uploads per minute)
        RateLimiter::for('storage-upload', function (Request $request) {
            return Limit::perMinute(20)->by($request->user()?->id ?: $request->ip())->response(function () {
                return response()->json([
                    'error' => 'Upload rate limit reached. Please wait a moment before uploading more files.',
                ], 429);
            });
        });

        // 5. OCR Processing Rate Limiter (10 operations per minute)
        RateLimiter::for('ocr-operations', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip())->response(function () {
                return response()->json([
                    'error' => 'OCR processing limit reached. Please wait a minute before requesting OCR again.',
                ], 429);
            });
        });
    }
}
