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
    })->create();

// Load unified environment configuration from root .env.deployment
$app->useEnvironmentPath(dirname(__DIR__, 2));
$app->loadEnvironmentFrom('.env.deployment');

return $app;
