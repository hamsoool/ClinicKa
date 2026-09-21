<?php

namespace Tests\Unit;

use App\Models\AuditLog;
use App\Models\Profile;
use App\Services\AuditService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class AuditServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (Schema::hasTable('audit_logs')) {
            return;
        }

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('actor_user_id')->nullable();
            $table->string('actor_role')->nullable();
            $table->string('category')->nullable();
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->string('target_id')->nullable();
            $table->string('student_id')->nullable();
            $table->string('result')->nullable();
            $table->string('reason')->nullable();
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->json('metadata')->nullable();
            $table->uuid('user_id')->nullable();
            $table->string('role')->nullable();
            $table->string('target_student_id')->nullable();
            $table->uuid('submission_id')->nullable();
            $table->uuid('file_id')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function test_actor_and_role_are_derived_from_the_request_user(): void
    {
        $actor = new Profile([
            'id' => 'actor-1',
            'role' => 'admin',
        ]);
        $request = Request::create('/api/v1/admin/audit-logs');
        $request->setUserResolver(fn () => $actor);

        $log = app(AuditService::class)->record('ROLE_CHANGED', [
            'actor_user_id' => 'spoofed-user',
            'actor_role' => 'student',
            'metadata' => [
                'title' => 'Role update',
                'diagnosis' => 'must not be stored',
            ],
        ], $request);

        $this->assertSame('actor-1', $log->actor_user_id);
        $this->assertSame('admin', $log->actor_role);
        $this->assertSame(['title' => 'Role update'], $log->metadata);
    }

    public function test_audit_log_cannot_be_updated_or_deleted(): void
    {
        $log = AuditLog::create([
            'action' => 'TEST_EVENT',
            'result' => AuditService::RESULT_SUCCESS,
        ]);

        $this->expectException(RuntimeException::class);
        $log->action = 'CHANGED';
        $log->save();
    }
}