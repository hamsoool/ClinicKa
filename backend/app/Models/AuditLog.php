<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AuditLog extends Model
{
    protected $table = 'audit_logs';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    const UPDATED_AT = null;

    protected $fillable = [
        'id',
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
        try {
            static::create([
                'user_id' => $userId,
                'role' => $role,
                'action' => $action,
                'target_student_id' => $targetStudentId,
                'submission_id' => $submissionId,
                'file_id' => $fileId,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'metadata' => $metadata,
            ]);
        } catch (\Throwable) {
            // Non-blocking for audit logging
        }
    }
}
