<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | ClinicKa on-premise physical server CORS policy.
    | Strictly allows local origins and campus hostnames.
    |
    */

    'paths' => ['api/*', 'functions/*', 'rest/*', 'storage/*', 'up', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_filter(array_map('trim', explode(',', env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000'
    )))),

    'allowed_origins_patterns' => [
        '#^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$#',
        '#^https?://([a-zA-Z0-9-]+\.)?gordoncollege\.edu\.ph(:\d+)?$#',
        '#^https?://([a-zA-Z0-9-]+\.)?ngrok(-free)?\.(app|dev)(:\d+)?$#',
        '#^https?://([a-zA-Z0-9-]+\.)?trycloudflare\.com(:\d+)?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [
        'X-Content-Type-Options',
        'X-Server-Time',
        'Retry-After',
    ],

    'max_age' => 86400,

    'supports_credentials' => true,

];
