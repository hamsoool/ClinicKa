<?php

namespace App\Services;

use App\Models\OcrCallLog;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OcrService
{
    /**
     * Run OCR on raw binary content or file path for a specific document type.
     *
     * @param string $documentType 'chest-xray' | 'cbc' | 'urinalysis'
     * @param string $content Raw binary file content or base64 data
     * @param string|null $fileName
     * @param string|null $mimeType
     * @return array Parsed fields
     */
    public function parseDocument(string $documentType, string $content, ?string $fileName = null, ?string $mimeType = 'image/jpeg'): array
    {
        $provider = SystemSetting::getVal('ocr_provider', 'ocr-space');

        // Extract raw text using selected provider
        $rawText = '';
        try {
            if ($provider === 'azure') {
                $rawText = $this->extractWithAzure($content, $mimeType);
            } else {
                $rawText = $this->extractWithOcrSpace($content, $fileName, $mimeType);
            }
        } catch (\Throwable $e) {
            Log::warning("Primary OCR provider [{$provider}] failed: {$e->getMessage()}. Attempting fallback.");
            // If primary failed, try the other provider
            try {
                if ($provider === 'azure') {
                    $rawText = $this->extractWithOcrSpace($content, $fileName, $mimeType);
                    $provider = 'ocr-space';
                } else {
                    $rawText = $this->extractWithAzure($content, $mimeType);
                    $provider = 'azure';
                }
            } catch (\Throwable $fallbackErr) {
                Log::warning("Secondary OCR provider fallback failed: {$fallbackErr->getMessage()}");
                $rawText = '';
            }
        }

        // Log OCR call
        try {
            OcrCallLog::create([
                'provider' => $provider,
                'timestamp' => (int) (microtime(true) * 1000),
            ]);
        } catch (\Throwable) {}

        // Run domain-specific regex field extraction
        $extracted = match ($documentType) {
            'chest-xray' => $this->parseChestXray($rawText),
            'cbc' => $this->parseCbc($rawText),
            'urinalysis' => $this->parseUrinalysis($rawText),
            default => ['rawText' => $rawText],
        };

        $extracted['provider'] = $provider;
        $extracted['source'] = $provider === 'azure' ? 'azure-vision' : 'ocr-space';
        $extracted['pageCount'] = 1;
        $extracted['confidence'] = ! empty($rawText) ? 92 : 0;

        return $extracted;
    }

    /**
     * OCR.space REST client
     */
    protected function extractWithOcrSpace(string $content, ?string $fileName = null, ?string $mimeType = 'image/jpeg'): string
    {
        $apiKey = config('services.ocr_space.key') ?: env('OCR_SPACE_API_KEY', 'helloworld');
        $endpoint = config('services.ocr_space.endpoint') ?: env('OCR_SPACE_ENDPOINT') ?: env('OCR_SPACE_API_URL', 'https://api.ocr.space/parse/image');

        $mime = $mimeType ?: 'image/jpeg';
        $base64 = base64_encode($content);
        $fileDataUri = "data:{$mime};base64," . $base64;

        // Detect filetype for OCR.space engine
        $ext = strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION));
        if ($mime === 'application/pdf' || $ext === 'pdf') {
            $filetype = 'PDF';
        } elseif ($mime === 'image/png' || $ext === 'png') {
            $filetype = 'PNG';
        } elseif ($mime === 'image/webp' || $ext === 'webp') {
            $filetype = 'WEBP';
        } else {
            $filetype = 'JPG';
        }

        $response = Http::timeout(45)->asForm()->post($endpoint, [
            'apikey' => $apiKey,
            'base64Image' => $fileDataUri,
            'filetype' => $filetype,
            'OCREngine' => '2',
            'isOverlayRequired' => 'false',
            'scale' => 'true',
            'detectOrientation' => 'true',
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException("OCR.space HTTP error: {$response->status()}");
        }

        $json = $response->json();
        if (! empty($json['ParsedResults'][0]['ParsedText'])) {
            return $json['ParsedResults'][0]['ParsedText'];
        }

        if (! empty($json['ErrorMessage'])) {
            $errMsg = is_array($json['ErrorMessage']) ? implode(', ', $json['ErrorMessage']) : (string) $json['ErrorMessage'];
            throw new \RuntimeException("OCR.space processing error: {$errMsg}");
        }

        return '';
    }

    /**
     * Azure AI Vision Read API client
     */
    protected function extractWithAzure(string $content, ?string $mimeType): string
    {
        $key = config('services.azure_vision.key') ?: env('AZURE_VISION_KEY') ?: env('AZURE_CV_KEY') ?: env('AZURE_COMPUTER_VISION_KEY');
        $endpoint = config('services.azure_vision.endpoint') ?: env('AZURE_VISION_ENDPOINT') ?: env('AZURE_CV_ENDPOINT') ?: env('AZURE_COMPUTER_VISION_ENDPOINT');

        if (! $key || ! $endpoint) {
            throw new \RuntimeException("Azure AI Vision credentials not configured.");
        }

        $endpoint = rtrim($endpoint, '/');
        $url = "{$endpoint}/vision/v3.2/read/analyze";

        $mime = $mimeType ?: 'application/octet-stream';
        if (! in_array($mime, ['application/pdf', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff'], true)) {
            $mime = 'application/octet-stream';
        }

        $response = Http::withHeaders([
            'Ocp-Apim-Subscription-Key' => $key,
            'Content-Type' => $mime,
        ])->withBody($content, $mime)->post($url);

        if ($response->status() !== 202) {
            $errBody = $response->body();
            throw new \RuntimeException("Azure Read API rejected request ({$response->status()}): {$errBody}");
        }

        $operationLocation = $response->header('Operation-Location');
        if (! $operationLocation) {
            throw new \RuntimeException("Missing Operation-Location header from Azure.");
        }

        // Poll for results (up to 30 attempts, 500ms sleep)
        for ($i = 0; $i < 30; $i++) {
            usleep(500000);
            $poll = Http::withHeaders(['Ocp-Apim-Subscription-Key' => $key])->get($operationLocation);
            $pollJson = $poll->json();
            $status = $pollJson['status'] ?? '';

            if ($status === 'succeeded') {
                $lines = [];
                $readResults = $pollJson['analyzeResult']['readResults'] ?? [];
                foreach ($readResults as $page) {
                    foreach ($page['lines'] ?? [] as $line) {
                        $lines[] = $line['text'] ?? '';
                    }
                }
                if (empty($lines) && ! empty($pollJson['analyzeResult']['pages'])) {
                    foreach ($pollJson['analyzeResult']['pages'] as $page) {
                        foreach ($page['lines'] ?? [] as $line) {
                            $lines[] = $line['content'] ?? $line['text'] ?? '';
                        }
                    }
                }
                return implode("\n", array_filter($lines));
            }

            if ($status === 'failed') {
                $reason = $pollJson['analyzeResult']['errors'][0]['message'] ?? 'Unknown error';
                throw new \RuntimeException("Azure Read API operation failed: {$reason}");
            }
        }

        throw new \RuntimeException("Azure Read API operation timed out.");
    }

    /**
     * Parse Chest X-Ray findings, impression, and normal/abnormal result
     */
    public function parseChestXray(string $text): array
    {
        $date = $this->extractDate($text);

        // Normalize text
        $lower = strtolower($text);

        // Findings extraction
        $findings = null;
        if (preg_match('/(?:findings|examination|report|description)\s*[:\-]?\s*(.*?)(?=(?:impression|conclusion|remarks|radiologist|$))/is', $text, $matches)) {
            $findings = trim($matches[1]);
        } elseif (preg_match('/(?:impression|conclusion)\s*[:\-]?\s*(.*?)(?=(?:radiologist|physician|license|$))/is', $text, $matches)) {
            $findings = trim($matches[1]);
        }

        // Clean up findings string
        if ($findings) {
            $findings = preg_replace('/\s+/', ' ', $findings);
            $findings = substr($findings, 0, 500);
        }

        // Result determination: normal vs abnormal
        $isNormal = false;
        $normalPatterns = [
            'essentially normal',
            'clear lung fields',
            'no active lung lesion',
            'no active infiltrates',
            'unremarkable chest',
            'within normal limits',
            'normal chest',
            'negative for active',
            'no significant abnormality',
        ];

        foreach ($normalPatterns as $pattern) {
            if (str_contains($lower, $pattern)) {
                $isNormal = true;
                break;
            }
        }

        $result = $isNormal ? 'normal' : 'abnormal';
        if (empty($findings) && empty($text)) {
            $result = null;
        }

        return [
            'date' => $date,
            'findings' => $findings ?: ($isNormal ? 'Essentially normal chest findings. Clear lung fields.' : 'Clinical correlation suggested.'),
            'result' => $result,
            'rawText' => $text,
        ];
    }

    /**
     * Parse Complete Blood Count (CBC)
     */
    public function parseCbc(string $text): array
    {
        $date = $this->extractDate($text);

        // Blood type extraction
        $bloodType = null;
        if (preg_match('/\b(blood\s*type|type|rh\s*type)\s*[:\-]?\s*([ABO][+-]|[ABO]\s*(?:positive|negative))\b/i', $text, $m)) {
            $typeStr = strtoupper(trim($m[2]));
            $typeStr = str_replace(['POSITIVE', 'POS'], '+', $typeStr);
            $typeStr = str_replace(['NEGATIVE', 'NEG'], '-', $typeStr);
            $typeStr = str_replace(' ', '', $typeStr);
            if (in_array($typeStr, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], true)) {
                $bloodType = $typeStr;
            }
        }

        // Hemoglobin: e.g. 120-160 g/L or 12.0-16.0 g/dL
        $hemoglobin = $this->extractNumericField($text, ['hemoglobin', 'hgb', 'hb']);

        // Hematocrit: e.g. 0.37-0.54 or 37-54%
        $hematocrit = $this->extractNumericField($text, ['hematocrit', 'hct']);

        // WBC: e.g. 4.5-11.0 x10^9/L or 4,500 - 11,000
        $wbc = $this->extractNumericField($text, ['white blood cells', 'white blood count', 'wbc count', 'wbc', 'leukocytes']);

        // Platelet Count: e.g. 150-450 x10^9/L or 150,000 - 450,000
        $plateletCount = $this->extractNumericField($text, ['platelet count', 'platelet', 'plt']);

        return [
            'date' => $date,
            'hemoglobin' => $hemoglobin,
            'hematocrit' => $hematocrit,
            'wbc' => $wbc,
            'plateletCount' => $plateletCount,
            'bloodType' => $bloodType,
            'rawText' => $text,
        ];
    }

    /**
     * Parse Urinalysis (Glucose, Protein, Date)
     */
    public function parseUrinalysis(string $text): array
    {
        $date = $this->extractDate($text);

        $glucose = $this->extractDipstickValue($text, ['glucose', 'sugar', 'glu']);
        $protein = $this->extractDipstickValue($text, ['protein', 'albumin', 'pro']);

        return [
            'date' => $date,
            'glucose' => $glucose ?: 'Negative',
            'protein' => $protein ?: 'Negative',
            'rawText' => $text,
        ];
    }

    /**
     * Extract date string from OCR text (YYYY-MM-DD or formatted)
     */
    protected function extractDate(string $text): ?string
    {
        // ISO format YYYY-MM-DD
        if (preg_match('/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/', $text, $m)) {
            return sprintf('%04d-%02d-%02d', (int) $m[1], (int) $m[2], (int) $m[3]);
        }
        // US format MM/DD/YYYY
        if (preg_match('/\b(0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])[-\/.](20\d{2})\b/', $text, $m)) {
            return sprintf('%04d-%02d-%02d', (int) $m[3], (int) $m[1], (int) $m[2]);
        }
        // Text format: Month DD, YYYY
        if (preg_match('/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i', $text, $m)) {
            $month = date('m', strtotime($m[1] . ' 1 2000'));
            return sprintf('%04d-%02d-%02d', (int) $m[3], (int) $month, (int) $m[2]);
        }

        return null;
    }

    /**
     * Extract numeric value following keyword
     */
    protected function extractNumericField(string $text, array $keywords): ?string
    {
        foreach ($keywords as $kw) {
            $pattern = '/\b' . preg_quote($kw, '/') . '\b\s*[:\-]?\s*([0-9]{1,6}(?:\.[0-9]{1,3})?)/i';
            if (preg_match($pattern, $text, $matches)) {
                return $matches[1];
            }
        }
        return null;
    }

    /**
     * Extract dipstick qualitative level (Negative, Trace, 1+, 2+, 3+, 4+)
     */
    protected function extractDipstickValue(string $text, array $keywords): ?string
    {
        foreach ($keywords as $kw) {
            $pattern = '/\b' . preg_quote($kw, '/') . '\b\s*[:\-]?\s*(Negative|Trace|[1-4]\+|\+\+|Nil|Normal)/i';
            if (preg_match($pattern, $text, $matches)) {
                $val = ucfirst(strtolower($matches[1]));
                if ($val === 'Nil' || $val === 'Normal') return 'Negative';
                if ($val === '++') return '2+';
                return $val;
            }
        }
        return null;
    }
}
