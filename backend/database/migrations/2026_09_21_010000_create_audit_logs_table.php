<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('audit_logs')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('audit_logs', 'actor_user_id')) {
                    $table->uuid('actor_user_id')->nullable()->after('id');
                }
                if (! Schema::hasColumn('audit_logs', 'actor_role')) {
                    $table->string('actor_role', 40)->nullable()->after('actor_user_id');
                }
                if (! Schema::hasColumn('audit_logs', 'category')) {
                    $table->string('category', 40)->default('medical_record')->after('actor_role');
                }
                if (! Schema::hasColumn('audit_logs', 'target_type')) {
                    $table->string('target_type', 60)->nullable()->after('action');
                }
                if (! Schema::hasColumn('audit_logs', 'target_id')) {
                    $table->string('target_id', 191)->nullable()->after('target_type');
                }
                if (! Schema::hasColumn('audit_logs', 'student_id')) {
                    $table->string('student_id', 50)->nullable()->after('target_id');
                }
                if (! Schema::hasColumn('audit_logs', 'result')) {
                    $table->string('result', 20)->default('SUCCESS')->after('student_id');
                }
                if (! Schema::hasColumn('audit_logs', 'reason')) {
                    $table->string('reason', 255)->nullable()->after('result');
                }
            });

            $indexes = collect(Schema::getIndexes('audit_logs'))->pluck('name')->all();
            Schema::table('audit_logs', function (Blueprint $table) use ($indexes) {
                if (! in_array('audit_logs_actor_created_idx', $indexes, true)) {
                    $table->index(['actor_user_id', 'created_at'], 'audit_logs_actor_created_idx');
                }
                if (! in_array('audit_logs_student_created_idx', $indexes, true)) {
                    $table->index(['student_id', 'created_at'], 'audit_logs_student_created_idx');
                }
                if (! in_array('audit_logs_category_created_idx', $indexes, true)) {
                    $table->index(['category', 'created_at'], 'audit_logs_category_created_idx');
                }
                if (! in_array('audit_logs_result_created_idx', $indexes, true)) {
                    $table->index(['result', 'created_at'], 'audit_logs_result_created_idx');
                }
                if (! in_array('audit_logs_target_idx', $indexes, true)) {
                    $table->index(['target_type', 'target_id'], 'audit_logs_target_idx');
                }
            });

            return;
        }

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('actor_user_id')->nullable();
            $table->string('actor_role', 40)->nullable();
            $table->string('category', 40)->default('medical_record');
            $table->string('action', 100);
            $table->string('target_type', 60)->nullable();
            $table->string('target_id', 191)->nullable();
            $table->string('student_id', 50)->nullable();
            $table->string('result', 20)->default('SUCCESS');
            $table->string('reason', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('metadata')->nullable();

            // Compatibility columns used by the existing audit writer and exports.
            $table->uuid('user_id')->nullable();
            $table->string('role', 40)->nullable();
            $table->string('target_student_id', 50)->nullable();
            $table->uuid('submission_id')->nullable();
            $table->uuid('file_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['actor_user_id', 'created_at'], 'audit_logs_actor_created_idx');
            $table->index(['action', 'created_at'], 'audit_logs_action_created_idx');
            $table->index(['category', 'created_at'], 'audit_logs_category_created_idx');
            $table->index(['student_id', 'created_at'], 'audit_logs_student_created_idx');
            $table->index(['result', 'created_at'], 'audit_logs_result_created_idx');
            $table->index(['target_type', 'target_id'], 'audit_logs_target_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};