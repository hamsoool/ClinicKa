<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\FileRecord;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StorageService
{
    public const DISK_SECURE = 'secure_medical';
    public const DISK_PUBLIC = 'public';

    /**
     * Category to subfolder mapping on secure disk.
     */
    protected const CATEGORY_FOLDERS = [
        'xray' => 'xrays',
        'chest_xray' => 'xrays',
        'cbc' => 'cbc',
        'urinalysis' => 'urinalysis',
        'signature' => 'signatures',
        'photo' => 'photos',
        'certificate' => 'certificates',
    ];

    /**
     * Allowed MIME types per upload category (magic-byte checked).
     */
    public const ALLOWED_MIMES = [
        'photo' => ['image/jpeg', 'image/png', 'image/webp'],
        'signature' => ['image/png', 'image/jpeg'],
        'xray' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
        'chest_xray' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
        'cbc' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
        'urinalysis' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
        'announcement' => ['image/jpeg', 'image/png', 'image/webp'],
        'certificate' => ['application/pdf'],
    ];

    /**
     * Max byte limits per category.
     */
    public const MAX_SIZES = [
        'xray' => 50 * 1024 * 1024,        // 50 MB for high-res X-rays / DICOM
        'chest_xray' => 50 * 1024 * 1024,  // 50 MB
        'cbc' => 25 * 1024 * 1024,         // 25 MB for CBC lab reports
        'urinalysis' => 25 * 1024 * 1024,  // 25 MB for Urinalysis lab reports
        'default' => 15 * 1024 * 1024,     // 15 MB for general uploads
    ];

    /**
     * Determine which disk to use based on upload category.
     */
    public function resolveDisk(string $category): string
    {
        return $category === 'announcement' ? self::DISK_PUBLIC : self::DISK_SECURE;
    }

    /**
     * Derive 256-bit AES key for at-rest file encryption.
     */
    protected function getFileEncryptionKey(): string
    {
        $appKey = config('app.key');
        if (str_starts_with($appKey, 'base64:')) {
            $appKey = base64_decode(substr($appKey, 7));
        }
        return hash('sha256', $appKey, true);
    }

    /**
     * Verify real MIME type using magic bytes via fileinfo.
     */
    public function detectMimeType(string $filePath): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $filePath);
        finfo_close($finfo);
        return $mime ?: 'application/octet-stream';
    }

    /**
     * Validate upload constraints (size & magic-byte MIME).
     */
    public function validateUpload(string $filePath, int $fileSize, string $category): string
    {
        // 1. Size quota check
        $maxBytes = self::MAX_SIZES[$category] ?? self::MAX_SIZES['default'];
        if ($fileSize > $maxBytes) {
            $mb = $maxBytes / (1024 * 1024);
            throw new \InvalidArgumentException("File exceeds maximum allowed size of {$mb}MB for category [{$category}].");
        }

        // 2. Real MIME check
        $realMime = $this->detectMimeType($filePath);
        $allowed = self::ALLOWED_MIMES[$category] ?? ['image/jpeg', 'image/png', 'application/pdf'];

        if (! in_array($realMime, $allowed, true)) {
            $allowedStr = implode(', ', $allowed);
            throw new \InvalidArgumentException("Invalid file format [{$realMime}]. Allowed types for {$category}: {$allowedStr}.");
        }

        return $realMime;
    }

    /**
     * Strip EXIF metadata (GPS, camera details, timestamps) from images for privacy.
     */
    public function sanitizeExif(string $rawContent, string $mimeType): string
    {
        if (! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $rawContent;
        }

        try {
            $im = @imagecreatefromstring($rawContent);
            if (! $im) {
                return $rawContent;
            }

            if (in_array($mimeType, ['image/png', 'image/webp'], true)) {
                imagealphablending($im, false);
                imagesavealpha($im, true);
            }

            ob_start();
            match ($mimeType) {
                'image/jpeg' => imagejpeg($im, null, 92),
                'image/png' => imagepng($im, null, 6),
                'image/webp' => imagewebp($im, null, 90),
                default => imagejpeg($im, null, 92),
            };
            $sanitized = ob_get_clean();
            imagedestroy($im);

            return $sanitized ?: $rawContent;
        } catch (\Throwable) {
            return $rawContent;
        }
    }

    /**
     * Scan PDF documents for dangerous active executable objects (JavaScript, Launch actions).
     */
    public function scanPdfForActiveContent(string $content): void
    {
        $dangerousPatterns = [
            '/\/JavaScript/i' => 'Embedded JavaScript in PDF is strictly prohibited for security.',
            '/\/JS\b/i' => 'Embedded JS script in PDF is strictly prohibited for security.',
            '/\/Launch\b/i' => 'Executable launch actions in PDF are strictly prohibited.',
            '/\/EmbeddedFiles/i' => 'Embedded file attachments in PDF are not permitted.',
        ];

        foreach ($dangerousPatterns as $pattern => $message) {
            if (preg_match($pattern, $content)) {
                throw new \InvalidArgumentException($message);
            }
        }
    }

    /**
     * Generate a short-lived cryptographic ticket for streaming media without exposing auth tokens in URLs.
     */
    public function generateStreamingTicket(FileRecord $file, string $userId, int $ttlSeconds = 60): string
    {
        $expiresAt = time() + $ttlSeconds;
        $data = "{$file->id}:{$userId}:{$expiresAt}";
        $signature = hash_hmac('sha256', $data, $this->getFileEncryptionKey());
        return base64_encode("{$data}:{$signature}");
    }

    /**
     * Verify a short-lived streaming ticket and return the authorized userId if valid and not expired.
     */
    public function verifyStreamingTicket(string $ticket, string $fileId): ?string
    {
        try {
            $decoded = base64_decode($ticket, true);
            if (! $decoded) return null;

            $parts = explode(':', $decoded);
            if (count($parts) !== 4) return null;

            [$ticketFileId, $userId, $expiresAt, $signature] = $parts;

            if ($ticketFileId !== $fileId) return null;
            if ((int) $expiresAt < time()) return null;

            $data = "{$ticketFileId}:{$userId}:{$expiresAt}";
            $expectedSignature = hash_hmac('sha256', $data, $this->getFileEncryptionKey());

            if (! hash_equals($expectedSignature, $signature)) {
                return null;
            }

            return $userId;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Encrypt file content with AES-256-GCM before writing to physical disk.
     */
    public function encryptPayload(string $rawContent): string
    {
        $key = $this->getFileEncryptionKey();
        $iv = random_bytes(12);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $rawContent,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );

        if ($ciphertext === false) {
            throw new \RuntimeException('Failed to encrypt file payload at rest.');
        }

        // Pack format: 12-byte IV + 16-byte Tag + Ciphertext
        return $iv . $tag . $ciphertext;
    }

    /**
     * Decrypt at-rest AES-256-GCM encrypted file payload from disk.
     */
    public function decryptPayload(string $packedContent): string
    {
        if (strlen($packedContent) < 28) {
            throw new \RuntimeException('Corrupted encrypted file package (insufficient header size).');
        }

        $key = $this->getFileEncryptionKey();
        $iv = substr($packedContent, 0, 12);
        $tag = substr($packedContent, 12, 16);
        $ciphertext = substr($packedContent, 28);

        $plaintext = openssl_decrypt(
            $ciphertext,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new \RuntimeException('Failed to decrypt file payload. Authentication tag verification failed.');
        }

        return $plaintext;
    }

    /**
     * Store sanitized & encrypted file and register in master files table.
     */
    public function storeFile(
        UploadedFile|string $fileOrBinary,
        string $category,
        ?string $originalName = null,
        ?string $submissionId = null,
        ?string $uploadedBy = null
    ): FileRecord {
        $tempPath = null;

        if ($fileOrBinary instanceof UploadedFile) {
            $tempPath = $fileOrBinary->getRealPath();
            $originalName = $originalName ?: $fileOrBinary->getClientOriginalName();
            $fileSize = $fileOrBinary->getSize();
            $rawContent = file_get_contents($tempPath);
        } else {
            $rawContent = $fileOrBinary;
            $fileSize = strlen($rawContent);
            $temp = tmpfile();
            fwrite($temp, $rawContent);
            $tempPath = stream_get_meta_data($temp)['uri'];
            $originalName = $originalName ?: "upload_{$category}.bin";
        }

        // Sanitize original file name: strip null bytes, directory traversal, and control characters
        $originalName = preg_replace('/[^\p{L}\p{N}._-]/u', '_', basename(str_replace("\0", '', (string) $originalName)));

        // 1. Validate magic bytes & size
        $realMime = $this->validateUpload($tempPath, $fileSize, $category);

        // 1.1 Content Disarm & Security Scan (PDF active content inspection)
        if ($realMime === 'application/pdf') {
            $this->scanPdfForActiveContent($rawContent);
        }

        // 2. Strip EXIF metadata
        $sanitizedContent = $this->sanitizeExif($rawContent, $realMime);

        // 2.1 Calculate cryptographic SHA-256 digest for anti-tampering verification
        $fileHash = hash('sha256', $sanitizedContent);

        // 3. Resolve disk & paths
        $disk = $this->resolveDisk($category);
        $uuid = (string) Str::uuid();

        if ($disk === self::DISK_SECURE) {
            $extension = 'enc';
            $finalContent = $this->encryptPayload($sanitizedContent);
            $folder = self::CATEGORY_FOLDERS[$category] ?? 'records';
        } else {
            $extension = pathinfo($originalName, PATHINFO_EXTENSION) ?: 'jpg';
            $finalContent = $sanitizedContent;
            $folder = 'announcements';
        }

        $storagePath = "{$folder}/{$uuid}.{$extension}";

        // 4. Write to physical disk
        Storage::disk($disk)->put($storagePath, $finalContent);

        // 5. Proxy URL
        $ext = pathinfo($originalName, PATHINFO_EXTENSION);
        $extSuffix = $ext ? ".{$ext}" : '';
        $proxyUrl = $disk === self::DISK_PUBLIC
            ? "/api/storage/{$storagePath}"
            : "/api/v1/storage/file/{$uuid}{$extSuffix}";

        // 6. Save in master files registry
        $fileRecord = FileRecord::create([
            'id' => $uuid,
            'submission_id' => $submissionId,
            'type' => $category,
            'file_name' => $originalName,
            'mime_type' => $realMime,
            'file_hash' => $fileHash,
            'url' => $proxyUrl,
            'storage_bucket' => $disk,
            'storage_path' => $storagePath,
            'storage_provider' => 'local',
            'uploaded_by' => $uploadedBy,
            'uploaded_at' => now(),
        ]);

        AuditLog::logAction('FILE_UPLOAD', $uploadedBy, null, null, $submissionId, $uuid, [
            'category' => $category,
            'file_name' => $originalName,
            'mime_type' => $realMime,
            'file_hash' => $fileHash,
            'size' => strlen($finalContent),
        ]);

        return $fileRecord;
    }

    /**
     * Read and decrypt file contents for authorized streaming with tamper verification.
     */
    public function readFile(FileRecord $file): string
    {
        $path = ltrim((string) $file->storage_path, '/\\');
        $disk = $file->storage_bucket ?: self::DISK_SECURE;

        $targetDisk = null;
        $candidateDisks = array_unique([$disk, self::DISK_SECURE, 'local', 'public']);

        foreach ($candidateDisks as $d) {
            if (Storage::disk($d)->exists($path)) {
                $targetDisk = $d;
                break;
            }
            $strippedPath = preg_replace('#^(secure_medical_records|secure_medical|private|public)/#', '', $path);
            if ($strippedPath !== $path && Storage::disk($d)->exists($strippedPath)) {
                $targetDisk = $d;
                $path = $strippedPath;
                break;
            }
        }

        if (! $targetDisk) {
            throw new \RuntimeException("Physical file not found on disk [{$file->storage_path}].");
        }

        $raw = Storage::disk($targetDisk)->get($path);

        $content = ($targetDisk === self::DISK_SECURE || str_ends_with($path, '.enc') || str_ends_with((string) $file->storage_path, '.enc'))
            ? $this->decryptPayload($raw)
            : $raw;

        // Anti-tamper verification: ensure decrypted bytes match stored SHA-256 hash
        if (! empty($file->file_hash)) {
            $computedHash = hash('sha256', $content);
            if (! hash_equals($file->file_hash, $computedHash)) {
                \Illuminate\Support\Facades\Log::critical('FILE INTEGRITY TAMPERING DETECTED', [
                    'file_id' => $file->id,
                    'file_name' => $file->file_name,
                    'expected_hash' => $file->file_hash,
                    'computed_hash' => $computedHash,
                ]);
                throw new \RuntimeException("File integrity verification failed for [{$file->id}]. The file may have been altered or corrupted.");
            }
        }

        return $content;
    }

    /**
     * Safely delete physical file and record from master storage.
     */
    public function pruneFile(FileRecord $file, ?string $prunedBy = null): bool
    {
        try {
            $disk = $file->storage_bucket ?: self::DISK_SECURE;
            if (Storage::disk($disk)->exists($file->storage_path)) {
                Storage::disk($disk)->delete($file->storage_path);
            }

            AuditLog::logAction('FILE_PRUNE', $prunedBy, null, null, $file->submission_id, $file->id, [
                'file_name' => $file->file_name,
                'category' => $file->type,
                'path' => $file->storage_path,
            ]);

            $file->delete();
            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
