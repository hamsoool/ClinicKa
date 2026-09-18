<?php

namespace App\Console\Commands;

use App\Models\Announcement;
use App\Models\Certificate;
use App\Models\EmergencyContact;
use App\Models\FileRecord;
use App\Models\LabCbc;
use App\Models\LabChestXray;
use App\Models\LabUrinalysis;
use App\Models\MedicalHistory;
use App\Models\Notification;
use App\Models\NotificationState;
use App\Models\Profile;
use App\Models\StaffMeasurement;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\Submission;
use App\Models\SystemSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Throwable;

class MigrateSupabaseCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:migrate-supabase 
                            {--path= : Path to directory containing exported Supabase JSON files}
                            {--default-password=Password123! : Default password for imported accounts without bcrypt hash}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import and migrate Supabase clinical records and accounts into MariaDB';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('=====================================================');
        $this->info(' ClinicKa: Supabase to MariaDB Migration Pipeline   ');
        $this->info('=====================================================');

        $dirPath = $this->option('path') ?: storage_path('migration');
        $defaultPassword = $this->option('default-password');

        if (! is_dir($dirPath)) {
            $this->warn("Migration source directory [{$dirPath}] does not exist.");
            $this->line("Creating directory [{$dirPath}] for you.");
            @mkdir($dirPath, 0755, true);
            $this->line("Place exported table JSON files (e.g. profiles.json, students.json, submissions.json) in this directory and re-run.");
            return self::SUCCESS;
        }

        $this->info("Scanning [{$dirPath}] for exported database tables...");

        $tables = [
            'system_settings' => SystemSetting::class,
            'profiles' => Profile::class,
            'students' => Student::class,
            'staff_users' => StaffUser::class,
            'submissions' => Submission::class,
            'emergency_contacts' => EmergencyContact::class,
            'medical_history' => MedicalHistory::class,
            'staff_measurements' => StaffMeasurement::class,
            'lab_chest_xray' => LabChestXray::class,
            'lab_cbc' => LabCbc::class,
            'lab_urinalysis' => LabUrinalysis::class,
            'certificates' => Certificate::class,
            'files' => FileRecord::class,
            'announcements' => Announcement::class,
            'notifications' => Notification::class,
            'notification_states' => NotificationState::class,
        ];

        DB::beginTransaction();

        try {
            // Temporarily disable foreign key checks during batch ingestion
            DB::statement('SET FOREIGN_KEY_CHECKS = 0;');

            $totalImported = 0;

            foreach ($tables as $table => $modelClass) {
                $filePath = $dirPath . DIRECTORY_SEPARATOR . "{$table}.json";
                if (! file_exists($filePath)) {
                    continue;
                }

                $this->line("--> Importing table: [{$table}]");
                $jsonContent = file_get_contents($filePath);
                $records = json_decode($jsonContent, true);

                if (! is_array($records)) {
                    $this->warn("    Skipping {$table}.json: invalid JSON structure.");
                    continue;
                }

                $count = 0;
                foreach ($records as $record) {
                    if (! is_array($record)) {
                        continue;
                    }

                    // For profiles, ensure password_hash exists
                    if ($table === 'profiles') {
                        if (empty($record['password_hash'])) {
                            $record['password_hash'] = Hash::make($defaultPassword);
                        }
                    }

                    // Cast booleans from SQLite / Postgres / JSON strings
                    foreach ($record as $k => $v) {
                        if ($v === 'true') $record[$k] = 1;
                        if ($v === 'false') $record[$k] = 0;
                    }

                    $primaryKey = (new $modelClass)->getKeyName();
                    if (isset($record[$primaryKey])) {
                        $modelClass::updateOrCreate([$primaryKey => $record[$primaryKey]], $record);
                    } else {
                        $modelClass::create($record);
                    }
                    $count++;
                }

                $this->info("    ✓ Successfully imported {$count} records into [{$table}].");
                $totalImported += $count;
            }

            DB::statement('SET FOREIGN_KEY_CHECKS = 1;');
            DB::commit();

            $this->newLine();
            $this->info("✓ Migration completed successfully! Total records processed: {$totalImported}");
            return self::SUCCESS;
        } catch (Throwable $e) {
            DB::rollBack();
            DB::statement('SET FOREIGN_KEY_CHECKS = 1;');
            $this->error("Migration failed: " . $e->getMessage());
            return self::FAILURE;
        }
    }
}
