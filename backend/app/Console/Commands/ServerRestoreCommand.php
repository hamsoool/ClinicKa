<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class ServerRestoreCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:server-restore 
                            {--file= : Path to the migration bundle .tar archive}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Restore all MariaDB tables and encrypted medical files from a migration bundle';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('=====================================================');
        $this->info(' ClinicKa: Physical Server Migration Restorer       ');
        $this->info('=====================================================');

        $filePath = $this->option('file');
        if (! $filePath || ! file_exists($filePath)) {
            $this->error("Migration archive file not found: [{$filePath}]");
            return self::FAILURE;
        }

        $phar = new \PharData($filePath);
        $stageRestoreDir = storage_path('backups' . DIRECTORY_SEPARATOR . 'restore_' . time());
        @mkdir($stageRestoreDir, 0755, true);
        $phar->extractTo($stageRestoreDir, null, true);

        // 1. Validate Manifest
        $manifestPath = $stageRestoreDir . DIRECTORY_SEPARATOR . 'migration_manifest.json';
        if (file_exists($manifestPath)) {
            $manifest = json_decode(file_get_contents($manifestPath), true);
            $this->info("Manifest verified: Exported from [{$manifest['exported_from']}] at " . date('Y-m-d H:i:s', $manifest['timestamp']));
        }

        // 2. Restore MariaDB Database Dump
        $sqlPath = $stageRestoreDir . DIRECTORY_SEPARATOR . 'database_dump.sql';
        if (! file_exists($sqlPath)) {
            $this->error("database_dump.sql missing from archive!");
            return self::FAILURE;
        }

        $this->line("--> Restoring MariaDB schema and records...");
        $sqlDump = file_get_contents($sqlPath);
        DB::unprepared($sqlDump);
        $this->info("    ✓ MariaDB database restored.");

        // 3. Extract Encrypted Medical Files
        $this->line("--> Restoring encrypted medical records...");
        $targetStorage = storage_path('app/secure_medical_records');
        @mkdir($targetStorage, 0755, true);
        $sourceMedicalDir = $stageRestoreDir . DIRECTORY_SEPARATOR . 'secure_medical_records';

        $restoredFiles = 0;
        if (is_dir($sourceMedicalDir)) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($sourceMedicalDir, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($files as $file) {
                if ($file->isFile()) {
                    $rel = substr($file->getPathname(), strlen($sourceMedicalDir) + 1);
                    $dest = $targetStorage . DIRECTORY_SEPARATOR . $rel;
                    @mkdir(dirname($dest), 0755, true);
                    copy($file->getPathname(), $dest);
                    $restoredFiles++;
                }
            }
        }
        $this->info("    ✓ Restored {$restoredFiles} encrypted medical files to local storage.");

        // Cleanup stage restore dir
        $it = new \RecursiveDirectoryIterator($stageRestoreDir, \RecursiveDirectoryIterator::SKIP_DOTS);
        $files = new \RecursiveIteratorIterator($it, \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getRealPath());
            } else {
                unlink($file->getRealPath());
            }
        }
        rmdir($stageRestoreDir);

        $this->newLine();
        $this->info("✓ Physical server migration restoration completed successfully!");
        return self::SUCCESS;
    }
}
