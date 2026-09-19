<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->throttleApi('api');
        $middleware->api(prepend: [
            \App\Http\Middleware\SecurityHeadersMiddleware::class,
            \App\Http\Middleware\DecryptPayloadMiddleware::class,
        ]);
        $middleware->api(append: [
            \App\Http\Middleware\EncryptPayloadMiddleware::class,
        ]);
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Security: Never leak file paths, stack traces, or internal details in API responses
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null; // let default HTML handler deal with web routes
            }

            $status = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;

            $safeMessages = [
                404 => 'The requested resource could not be found.',
                403 => 'Forbidden.',
                401 => 'Unauthenticated.',
                405 => 'Method not allowed.',
                422 => $e->getMessage() ?: 'Validation failed.',
                429 => 'Too many requests. Please try again later.',
            ];

            $message = $safeMessages[$status] ?? 'An internal error occurred.';

            // For validation errors, preserve the user-facing message
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return null; // let Laravel's default handler format validation errors
            }

            return response()->json([
                'error' => $message,
            ], $status);
        });
    })->create();

// Load unified environment configuration from root .env.deployment
$app->useEnvironmentPath(dirname(__DIR__, 2));
$app->loadEnvironmentFrom('.env.deployment');

return $app;
