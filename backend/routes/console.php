<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduled automated server maintenance routines
Schedule::command('app:server-backup')->dailyAt('02:00');
Schedule::command('sanctum:prune-expired --hours=48')->daily();
Schedule::command('cache:prune-stale-tags')->hourly();
