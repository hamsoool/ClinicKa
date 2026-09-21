<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

class PruneAuditLogsCommand extends Command
{
    protected $signature = 'audit:prune';

    protected $description = 'Delete audit logs older than the configured retention period';

    public function handle(): int
    {
        $retentionDays = max(1, (int) config('audit.retention_days', 365));
        $cutoff = now()->subDays($retentionDays);
        $deleted = AuditLog::where('created_at', '<', $cutoff)->delete();

        $this->info("Deleted {$deleted} audit logs older than {$retentionDays} days.");

        return self::SUCCESS;
    }
}
