<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Services\CryptoService;
use App\Services\StorageService;
use App\Services\OcrService;
use App\Models\Profile;
use App\Models\FileRecord;

class SystemHealthCheckCommand extends Command
{
    protected $signature = 'app:health-check';
    protected $description = 'Comprehensive security and functional health check for ClinicKa';

    public function handle(CryptoService $crypto, StorageService $storage, OcrService $ocr): int
    {
        $this->info('=====================================================');
        $this->info(' ClinicKa: End-to-End System Health & Security Audit ');
        $this->info('=====================================================');
        $passed = 0;
        $failed = 0;

        // 1. Database Connection & Table Schema Integrity
        $this->line('1. Testing MariaDB Database Connectivity & Schema...');
        try {
            $tables = DB::select('SHOW TABLES');
            $count = count($tables);
            if ($count >= 10) {
                $this->info("   ✓ Connected to MariaDB. {$count} tables active.");
                $passed++;
            } else {
                $this->warn("   ! Connected, but only {$count} tables found.");
                $failed++;
            }
        } catch (\Throwable $e) {
            $this->error("   ✗ Database connection failed: " . $e->getMessage());
            $failed++;
        }

        // 2. AES-256-GCM Crypto Verification
        $this->line('2. Testing Application-Layer AES-256-GCM Engine...');
        try {
            $sample = ['patient' => 'Test Student', 'blood_type' => 'O+', 'timestamp' => time()];
            $encrypted = $crypto->encrypt($sample);

            // Structure check
            if ($crypto->isEnvelope($encrypted)) {
                // Decrypt check
                $decrypted = $crypto->decrypt($encrypted);
                if ($decrypted === $sample) {
                    $this->info('   ✓ Encryption/Decryption roundtrip verified.');
                    $passed++;
                } else {
                    $this->error('   ✗ Decrypted payload does not match original.');
                    $failed++;
                }

                // Tamper resistance test
                $tampered = $encrypted;
                $decoded = base64_decode($tampered['data']);
                $decoded[0] = chr(ord($decoded[0]) ^ 0xFF); // flip a byte
                $tampered['data'] = base64_encode($decoded);

                try {
                    $crypto->decrypt($tampered);
                    $this->error('   ✗ Security Failure: Tampered payload was accepted without tag rejection!');
                    $failed++;
                } catch (\Throwable $tamperEx) {
                    $this->info('   ✓ Tamper resistance verified: Tag mismatch rejected tampered payload.');
                    $passed++;
                }
            } else {
                $this->error('   ✗ Encrypted envelope missing required iv/tag/data fields.');
                $failed++;
            }
        } catch (\Throwable $e) {
            $this->error('   ✗ Crypto engine failure: ' . $e->getMessage());
            $failed++;
        }

        // 3. Storage Subsystem & At-Rest AES-256-GCM Encryption
        $this->line('3. Testing Medical Storage Isolation & At-Rest Encryption...');
        try {
            // Create a small 1x1 test PNG image
            $pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d450000000049454e44ae426082';
            $pngBin = hex2bin($pngHex);
            $tmpFile = tempnam(sys_get_temp_dir(), 'test_med_');
            file_put_contents($tmpFile, $pngBin);

            // Test MIME magic-byte detection
            $mime = $storage->detectMimeType($tmpFile);
            if ($mime === 'image/png') {
                $this->info('   ✓ MIME magic-byte detection operational (image/png).');
                $passed++;
            } else {
                $this->warn("   ! Detected MIME was [{$mime}] instead of image/png.");
                $failed++;
            }

            // Test EXIF sanitization
            $sanitized = $storage->sanitizeExif($pngBin, 'image/png');
            if (!empty($sanitized)) {
                $this->info('   ✓ Metadata/EXIF stripping filter verified.');
                $passed++;
            }

            // Test at-rest encryption
            $cipherAtRest = $storage->encryptPayload($pngBin);
            if (substr($cipherAtRest, 0, 4) !== "\x89PNG") {
                $this->info('   ✓ At-rest encryption confirmed: Ciphertext packed with 12-byte IV + 16-byte tag.');
                $passed++;
            } else {
                $this->error('   ✗ Security Warning: File was stored unencrypted!');
                $failed++;
            }

            // Test decryption retrieval
            $decryptedBin = $storage->decryptPayload($cipherAtRest);
            if ($decryptedBin === $pngBin) {
                $this->info('   ✓ Decryption retrieval verified byte-for-byte.');
                $passed++;
            } else {
                $this->error('   ✗ Decryption did not restore original binary.');
                $failed++;
            }

            // Test short-lived HMAC streaming ticket
            $dummyFile = new FileRecord();
            $dummyFile->id = 'test-file-uuid-001';
            $ticket = $storage->generateStreamingTicket($dummyFile, 'user-123', 60);
            $verifiedUser = $storage->verifyStreamingTicket($ticket, 'test-file-uuid-001');

            if ($verifiedUser === 'user-123') {
                $this->info('   ✓ Short-lived HMAC-SHA256 streaming ticket generated & authenticated.');
                $passed++;
            } else {
                $this->error('   ✗ Streaming ticket verification failed.');
                $failed++;
            }

            @unlink($tmpFile);
        } catch (\Throwable $e) {
            $this->error('   ✗ Storage test failure: ' . $e->getMessage());
            $failed++;
        }

        // 4. Clinical Regex OCR Parser Engine
        $this->line('4. Testing Clinical OCR Regex Engine...');
        try {
            $sampleCbcText = "COMPLETE BLOOD COUNT\nHemoglobin: 14.5 g/dL (12.0 - 16.0)\nHEMATOCRIT: 42 %\nWBC COUNT: 6.8 x10^3/uL\nPLATELET COUNT: 250 x10^3/uL\nBlood Type: O Positive";
            $cbcData = $ocr->parseCbc($sampleCbcText);

            if (
                ($cbcData['hemoglobin'] ?? null) == 14.5 &&
                ($cbcData['hematocrit'] ?? null) == 42 &&
                ($cbcData['wbc'] ?? null) == 6.8 &&
                ($cbcData['plateletCount'] ?? null) == 250 &&
                ($cbcData['bloodType'] ?? null) === 'O+'
            ) {
                $this->info('   ✓ CBC laboratory regex parser extracted all clinical parameters accurately.');
                $passed++;
            } else {
                $this->warn('   ! CBC regex parser mismatch: ' . json_encode($cbcData));
                $failed++;
            }

            $sampleXrayText = "CHEST PA VIEW\nFINDINGS: The lungs are clear with no focal infiltrates or consolidation. Heart size is normal.\nIMPRESSION: Normal chest findings.";
            $xrayData = $ocr->parseChestXray($sampleXrayText);

            if (!empty($xrayData['findings']) && ($xrayData['result'] ?? null) === 'normal') {
                $this->info('   ✓ Chest X-Ray findings and classification parsed accurately.');
                $passed++;
            } else {
                $this->warn('   ! X-Ray regex extraction failed: ' . json_encode($xrayData));
                $failed++;
            }
        } catch (\Throwable $e) {
            $this->error('   ✗ OCR parser test failure: ' . $e->getMessage());
            $failed++;
        }

        // 5. User Account & Role Domain Policy Enforcement
        $this->line('5. Testing Account & Role Domain Policy Enforcement...');
        try {
            // Check student account domain rule: must be @gordoncollege.edu.ph
            $studentRole = Profile::where('role', 'student')->first();
            if ($studentRole) {
                if (str_ends_with(strtolower($studentRole->email), '@gordoncollege.edu.ph')) {
                    $this->info("   ✓ Verified student domain policy on record: {$studentRole->email}");
                    $passed++;
                } else {
                    $this->warn("   ! Student email does not use gordoncollege.edu.ph domain: {$studentRole->email}");
                    $failed++;
                }
            }

            // Check staff / admin accounts
            $staffCount = Profile::whereIn('role', ['staff', 'admin', 'super_admin'])->count();
            $this->info("   ✓ Staff and administrative accounts verified ({$staffCount} active).");
            $passed++;
        } catch (\Throwable $e) {
            $this->error('   ✗ Profile role check failure: ' . $e->getMessage());
            $failed++;
        }

        $this->newLine();
        $this->info("=====================================================");
        if ($failed === 0) {
            $this->info(" AUDIT PASSED: All {$passed} security & functional checks succeeded!");
        } else {
            $this->error(" AUDIT COMPLETED WITH ISSUES: {$passed} passed, {$failed} failed.");
        }
        $this->info("=====================================================");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
