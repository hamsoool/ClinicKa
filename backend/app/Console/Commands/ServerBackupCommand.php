<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class ServerBackupCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:server-backup 
                            {--output= : Destination path for migration archive}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Package all MariaDB clinical data, encrypted files, and settings for physical server migration';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('=====================================================');
        $this->info(' ClinicKa: Physical Server Migration Packager       ');
        $this->info('=====================================================');

        $timestamp = date('Ymd_His');
        $backupDir = storage_path('backups');
        @mkdir($backupDir, 0755, true);

        $defaultArchive = $backupDir . DIRECTORY_SEPARATOR . "clinicka_migration_bundle_{$timestamp}.tar";
        $archivePath = $this->option('output') ?: $defaultArchive;

        $this->line("Target migration archive: [{$archivePath}]");

        // Temporary staging folder
        $stageDir = $backupDir . DIRECTORY_SEPARATOR . "stage_{$timestamp}";
        @mkdir($stageDir, 0755, true);

        // 1. Export MariaDB Database Dump
        $this->line("--> Dumping MariaDB tables...");
        $sqlDump = "-- ClinicKa Database Migration Dump\n";
        $sqlDump .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
        $sqlDump .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        $tables = DB::select('SHOW TABLES');
        $dbName = config('database.connections.mariadb.database', 'clinicka');
        $tableKey = "Tables_in_{$dbName}";

        foreach ($tables as $t) {
            $tableName = $t->$tableKey ?? array_values((array)$t)[0];
            
            // Get CREATE TABLE
            $createTable = DB::select("SHOW CREATE TABLE `{$tableName}`");
            $sqlDump .= ($createTable[0]->{'Create Table'} ?? '') . ";\n\n";

            // Dump data
            $rows = DB::table($tableName)->get();
            if ($rows->count() > 0) {
                foreach ($rows as $row) {
                    $values = array_map(function ($val) {
                        if ($val === null) return 'NULL';
                        return "'" . addslashes((string)$val) . "'";
                    }, (array)$row);
                    $sqlDump .= "INSERT INTO `{$tableName}` VALUES (" . implode(', ', $values) . ");\n";
                }
                $sqlDump .= "\n";
            }
        }
        $sqlDump .= "SET FOREIGN_KEY_CHECKS = 1;\n";

        file_put_contents($stageDir . DIRECTORY_SEPARATOR . 'database_dump.sql', $sqlDump);
        $this->info("    ✓ MariaDB tables exported.");

        // 2. Include Encrypted Medical Record Files
        $this->line("--> Packaging encrypted medical records at rest...");
        $storageDiskPath = storage_path('app/secure_medical_records');
        $stageMedicalDir = $stageDir . DIRECTORY_SEPARATOR . 'secure_medical_records';
        @mkdir($stageMedicalDir, 0755, true);
        $fileCount = 0;

        if (is_dir($storageDiskPath)) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($storageDiskPath, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($files as $file) {
                if ($file->isFile()) {
                    $rel = substr($file->getPathname(), strlen($storageDiskPath) + 1);
                    $target = $stageMedicalDir . DIRECTORY_SEPARATOR . $rel;
                    @mkdir(dirname($target), 0755, true);
                    copy($file->getPathname(), $target);
                    $fileCount++;
                }
            }
        }
        $this->info("    ✓ Packaged {$fileCount} encrypted medical files.");

        // 3. Include Configuration Manifest
        $manifest = [
            'app_name' => config('app.name'),
            'timestamp' => time(),
            'version' => '1.0.0',
            'exported_from' => php_uname('n'),
            'file_count' => $fileCount,
            'sha256_sql' => hash('sha256', $sqlDump),
        ];
        file_put_contents($stageDir . DIRECTORY_SEPARATOR . 'migration_manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));

        // 4. Create Tar Archive
        if (file_exists($archivePath)) {
            @unlink($archivePath);
        }
        $phar = new \PharData($archivePath);
        $phar->buildFromDirectory($stageDir);

        // Cleanup stage dir
        $it = new \RecursiveDirectoryIterator($stageDir, \RecursiveDirectoryIterator::SKIP_DOTS);
        $files = new \RecursiveIteratorIterator($it, \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getRealPath());
            } else {
                unlink($file->getRealPath());
            }
        }
        rmdir($stageDir);

        $sizeMb = round(filesize($archivePath) / (1024 * 1024), 2);
        $this->newLine();
        $this->info("✓ Migration bundle created successfully: [{$archivePath}] ({$sizeMb} MB)");
        $this->line("This file can be transferred directly to the school's permanent physical server.");
        $this->line("Run [php artisan app:server-restore --file={$archivePath}] on the target server to restore.");

        return self::SUCCESS;
    }
}
