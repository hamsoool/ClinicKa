<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY_TABLES = [
        'users',
        'password_reset_tokens',
    ];

    public function up(): void
    {
        foreach (self::LEGACY_TABLES as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            if (DB::table($tableName)->count() > 0) {
                throw new RuntimeException(
                    "Refusing to drop non-empty legacy table [{$tableName}]. Review and migrate its data first.",
                );
            }
        }

        foreach (self::LEGACY_TABLES as $tableName) {
            Schema::dropIfExists($tableName);
        }
    }

    public function down(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }
};
