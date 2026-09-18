<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'ocr_space' => [
        'key' => env('OCR_SPACE_API_KEY', 'helloworld'),
        'endpoint' => env('OCR_SPACE_ENDPOINT') ?: env('OCR_SPACE_API_URL', 'https://api.ocr.space/parse/image'),
    ],

    'azure_vision' => [
        'key' => env('AZURE_VISION_KEY') ?: env('AZURE_CV_KEY') ?: env('AZURE_COMPUTER_VISION_KEY'),
        'endpoint' => env('AZURE_VISION_ENDPOINT') ?: env('AZURE_CV_ENDPOINT') ?: env('AZURE_COMPUTER_VISION_ENDPOINT'),
    ],

];
