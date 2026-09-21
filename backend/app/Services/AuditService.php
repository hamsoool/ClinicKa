<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Profile;
use App\Models\Submission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class AuditService
{
    public const RESULT_SUCCESS = 'SUCCESS';
    public const RESULT_DENIED = 'DENIED';
    public const RESULT_FAILURE = 'FAILURE';

    private const SENSITIVE_KEY_PATTERNS = [
        'password',
        'token',
        'secret',
        'key',
        'otp',
        'payload',
        'content',
        'diagnosis',
        'result',
        'finding',
        'symptom',
        'medication',
        'history',
        'notes',
        'xray',
        'cbc',
        'urinalysis',
        'hemoglobin',
        'hematocrit',
        'platelet',
        'glucose',
        'protein',
    ];

    public function record(
        string $action,
        array $context = [],
        ?Request $request = null,
        bool $critical = true
    ): AuditLog {
        $request = $request ?: request();
        $actor = $request?->user();

        $actorUserId = $actor?->id ?? ($context['actor_user_id'] ?? $context['user_id'] ?? null);
        $actorRole = $actor?->role ?? ($context['actor_role'] ?? $context['role'] ?? null);
        $submissionId = $context['submission_id'] ?? null;
        $studentId = $context['student_id'] ?? $context['target_student_id'] ?? null;

        if (! $studentId && $submissionId) {
            $studentId = Submission::whereKey($submissionId)->value('student_id');
        }

        $targetType = $context['target_type'] ?? null;
        $targetId = $context['target_id'] ?? null;

        if (! $targetType && ! empty($context['file_id'])) {
            $targetType = 'file';
            $targetId = $context['file_id'];
        } elseif (! $targetType && $submissionId) {
            $targetType = 'submission';
            $targetId = $submissionId;
        } elseif (! $targetType && $studentId) {
            $targetType = 'student';
            $targetId = $studentId;
        }

        $metadata = $this->sanitizeMetadata($context['metadata'] ?? null);
        $result = strtoupper((string) ($context['result'] ?? self::RESULT_SUCCESS));

        try {
            return AuditLog::query()->create([
                'actor_user_id' => $actorUserId,
                'actor_role' => $actorRole,
                'action' => $this->normalizeAction($action),
                'category' => $context['category'] ?? $this->inferCategory($action, $result),
                'target_type' => $targetType,
                'target_id' => $targetId,
                'student_id' => $studentId,
                'result' => in_array($result, [self::RESULT_SUCCESS, self::RESULT_DENIED, self::RESULT_FAILURE], true)
                    ? $result
                    : self::RESULT_FAILURE,
                'reason' => $this->sanitizeReason($context['reason'] ?? null),
                'ip_address' => $context['ip_address'] ?? $request?->ip(),
                'user_agent' => $context['user_agent'] ?? $request?->userAgent(),
                'metadata' => $metadata,

                // Legacy columns remain populated during the migration period.
                'user_id' => $actorUserId,
                'role' => $actorRole,
                'target_student_id' => $studentId,
                'submission_id' => $submissionId,
                'file_id' => $context['file_id'] ?? ($targetType === 'file' ? $targetId : null),
            ]);
        } catch (\Throwable $e) {
            Log::critical('Audit log write failed', [
                'action' => $action,
                'actor_user_id' => $actorUserId,
                'target_type' => $targetType,
                'target_id' => $targetId,
                'student_id' => $studentId,
                'result' => $result,
                'exception' => $e->getMessage(),
            ]);

            if ($critical) {
                throw new RuntimeException('Audit logging failed for a protected operation.', previous: $e);
            }

            throw $e;
        }
    }

    public function recordDenied(
        string $action,
        string $reason,
        array $context = [],
        ?Request $request = null
    ): AuditLog {
        return $this->record($action, [
            ...$context,
            'result' => self::RESULT_DENIED,
            'reason' => $reason,
            'category' => $context['category'] ?? 'security',
        ], $request);
    }

    public function actorLabel(?Profile $actor): string
    {
        if (! $actor) {
            return 'System';
        }

        $name = trim(($actor->first_name ?? '') . ' ' . ($actor->last_name ?? ''));
        return $name !== '' ? $name : (string) $actor->email;
    }

    private function normalizeAction(string $action): string
    {
        return strtoupper(preg_replace('/[^A-Z0-9_]+/', '_', trim($action)) ?: 'UNKNOWN_EVENT');
    }

    private function inferCategory(string $action, string $result): string
    {
        $action = $this->normalizeAction($action);

        if ($result === self::RESULT_DENIED || str_contains($action, 'UNAUTHORIZED') || str_contains($action, 'DENIED')) {
            return 'security';
        }

        return match (true) {
            str_contains($action, 'LOGIN'),
            str_contains($action, 'LOGOUT'),
            str_contains($action, 'PASSWORD'),
            str_contains($action, 'EMAIL_VERIFIED') => 'auth',
            str_contains($action, 'FILE'),
            str_contains($action, 'DOCUMENT') => 'medical_document',
            str_contains($action, 'STATUS'),
            str_contains($action, 'CLEARANCE'),
            str_contains($action, 'CERTIFICATE'),
            str_contains($action, 'SUBMIT_RECORD') => 'clearance',
            str_contains($action, 'ACCOUNT'),
            str_contains($action, 'ADMIN'),
            str_contains($action, 'SETTINGS'),
            str_contains($action, 'ARCHIVE'),
            str_contains($action, 'RESTORE') => 'admin',
            str_contains($action, 'ANNOUNCEMENT') => 'announcement',
            str_contains($action, 'PROFILE') => 'profile',
            str_contains($action, 'OCR') => 'ocr',
            default => 'medical_record',
        };
    }

    private function sanitizeReason(mixed $reason): ?string
    {
        $reason = trim((string) ($reason ?? ''));
        if ($reason === '') {
            return null;
        }

        return Str::limit($reason, 255, '');
    }

    private function sanitizeMetadata(?array $metadata): ?array
    {
        if (! $metadata) {
            return null;
        }

        $allowedKeys = array_flip(config('audit.metadata_allowed_keys', []));
        $clean = [];

        foreach ($metadata as $key => $value) {
            $normalizedKey = (string) $key;
            if (! isset($allowedKeys[$normalizedKey])) {
                continue;
            }

            if ($this->isSensitiveKey($normalizedKey)) {
                continue;
            }

            $clean[$normalizedKey] = $this->sanitizeMetadataValue($value);
        }

        return $clean === [] ? null : $clean;
    }

    private function sanitizeMetadataValue(mixed $value): mixed
    {
        if (is_scalar($value) || $value === null) {
            return is_string($value) ? Str::limit($value, 255, '') : $value;
        }

        if (! is_array($value)) {
            return null;
        }

        $clean = [];
        foreach ($value as $key => $nestedValue) {
            $key = (string) $key;
            if ($this->isSensitiveKey($key)) {
                continue;
            }
            $clean[$key] = is_array($nestedValue)
                ? '[nested]'
                : $this->sanitizeMetadataValue($nestedValue);
        }

        return $clean;
    }

    private function isSensitiveKey(string $key): bool
    {
        $lower = strtolower($key);

        foreach (self::SENSITIVE_KEY_PATTERNS as $pattern) {
            if (str_contains($lower, $pattern)) {
                return true;
            }
        }

        return false;
    }
}
