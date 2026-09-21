<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use RuntimeException;

class AuditLog extends Model
{
    protected $table = 'audit_logs';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    const UPDATED_AT = null;

    protected $fillable = [
        'id',
        'actor_user_id',
        'actor_role',
        'category',
        'target_type',
        'target_id',
        'student_id',
        'result',
        'reason',
        'user_id',
        'role',
        'action',
        'target_student_id',
        'submission_id',
        'file_id',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        static::updating(function () {
            throw new RuntimeException('Audit logs are append-only and cannot be updated.');
        });

        static::deleting(function () {
            throw new RuntimeException('Audit logs are append-only and cannot be deleted.');
        });
    }

    public static function logAction(
        string $action,
        ?string $userId = null,
        ?string $role = null,
        ?string $targetStudentId = null,
        ?string $submissionId = null,
        ?string $fileId = null,
        ?array $metadata = null
    ): void {
        app(\App\Services\AuditService::class)->record($action, [
            'actor_user_id' => $userId,
            'actor_role' => $role,
            'target_student_id' => $targetStudentId,
            'submission_id' => $submissionId,
            'file_id' => $fileId,
            'metadata' => $metadata,
        ]);
    }
}
