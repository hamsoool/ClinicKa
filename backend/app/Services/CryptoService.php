<?php

namespace App\Services;

use Exception;
use InvalidArgumentException;

class CryptoService
{
    protected string $key;
    protected const CIPHER = 'aes-256-gcm';
    protected const IV_LENGTH = 12; // 96-bit recommended for GCM
    protected const TAG_LENGTH = 16; // 128-bit tag

    public function __construct()
    {
        $rawKey = config('app.encryption_key')
            ?: env('APP_ENCRYPTION_KEY')
            ?: env('APP_KEY');

        if (empty($rawKey)) {
            throw new \RuntimeException('Encryption key is not configured. Set APP_ENCRYPTION_KEY in .env.');
        }

        // Normalize base64: prefix if present (from Laravel app keys)
        if (str_starts_with($rawKey, 'base64:')) {
            $rawKey = base64_decode(substr($rawKey, 7));
        }

        // Ensure key is exactly 32 bytes (256 bits) using SHA-256
        if (strlen($rawKey) === 32) {
            $this->key = $rawKey;
        } else {
            $this->key = hash('sha256', $rawKey, true);
        }
    }

    /**
     * Determine if a payload matches the encrypted envelope structure.
     */
    public function isEnvelope(mixed $data): bool
    {
        return is_array($data)
            && isset($data['iv'], $data['tag'], $data['data'])
            && is_string($data['iv'])
            && is_string($data['tag'])
            && is_string($data['data']);
    }

    /**
     * Encrypt any serializable data to an AES-256-GCM envelope.
     *
     * @param mixed $data
     * @return array{iv: string, tag: string, data: string}
     */
    public function encrypt(mixed $data): array
    {
        $plaintext = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($plaintext === false) {
            throw new InvalidArgumentException('Failed to JSON encode data for encryption.');
        }

        $iv = random_bytes(self::IV_LENGTH);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );

        if ($ciphertext === false) {
            throw new Exception('OpenSSL encryption failed.');
        }

        return [
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'data' => base64_encode($ciphertext),
        ];
    }

    /**
     * Decrypt an AES-256-GCM envelope back to its original PHP data structure.
     *
     * @param array{iv: string, tag: string, data: string} $envelope
     * @return mixed
     */
    public function decrypt(array $envelope): mixed
    {
        if (! $this->isEnvelope($envelope)) {
            throw new InvalidArgumentException('Invalid encrypted envelope format.');
        }

        $iv = base64_decode($envelope['iv'], true);
        $tag = base64_decode($envelope['tag'], true);
        $ciphertext = base64_decode($envelope['data'], true);

        if ($iv === false || strlen($iv) !== self::IV_LENGTH) {
            throw new InvalidArgumentException('Invalid IV in encrypted envelope.');
        }

        if ($tag === false || strlen($tag) !== self::TAG_LENGTH) {
            throw new InvalidArgumentException('Invalid authentication tag in encrypted envelope.');
        }

        if ($ciphertext === false) {
            throw new InvalidArgumentException('Invalid ciphertext in encrypted envelope.');
        }

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new Exception('Payload integrity verification failed: tag mismatch or corrupt ciphertext.');
        }

        $decoded = json_decode($plaintext, true);
        return $decoded !== null ? $decoded : $plaintext;
    }
}
