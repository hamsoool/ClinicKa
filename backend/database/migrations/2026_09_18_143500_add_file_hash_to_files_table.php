<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('files') && ! Schema::hasColumn('files', 'file_hash')) {
            Schema::table('files', function (Blueprint $table) {
                $table->char('file_hash', 64)->nullable()->after('mime_type')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('files') && Schema::hasColumn('files', 'file_hash')) {
            Schema::table('files', function (Blueprint $table) {
                $table->dropColumn('file_hash');
            });
        }
    }
};
