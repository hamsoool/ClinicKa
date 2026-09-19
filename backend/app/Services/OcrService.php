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
        $provider = SystemSetting::getVal('ocr_provider', env('OCR_PROVIDER', 'ocr-space'));

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

        // Radiologist extraction (Dr. Prefix)
        $radiologist = $this->extractRadiologistName($text);

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
            'lungs are clear',
            'lungfields are clear',
        ];

        foreach ($normalPatterns as $pattern) {
            if (str_contains($lower, $pattern)) {
                $isNormal = true;
                break;
            }
        }

        $result = $isNormal ? 'normal' : 'abnormal';
        if (empty($radiologist) && empty($text)) {
            $result = null;
        }

        return [
            'date' => $date,
            'findings' => $radiologist,
            'result' => $result,
            'rawText' => $text,
        ];
    }

    /**
     * Extract Radiologist name with Dr. prefix
     */
    public function extractRadiologistName(string $text): ?string
    {
        $cleanName = function (string $raw): ?string {
            $name = trim($raw);
            // Remove title suffixes (MD, M.D., FPCR, etc.)
            $name = preg_replace('/[,.-]?\s*\b(?:MD|M\.D\.|FPCR|FPC|DPBR|FACR|RRT|RMT)\b.*$/i', '', $name);
            // Remove leading labels or prefixes
            $name = preg_replace('/^(?:Radiologist|Physician|Doctor|Dr\.?)\s*[:.\-]?\s*/i', '', trim($name));
            $name = preg_replace('/^(?:Dr\.?)\s+/i', '', trim($name));
            // Remove trailing punctuation
            $name = trim($name, " \t\n\r\0\x0B,:.-");

            if (empty($name) || strlen($name) < 2) {
                return null;
            }

            // Exclude noise or clinical phrases
            if (preg_match('/\b(?:findings|impression|examination|history|chest|patient|normal|clear|heart|lungs|sinuses|negative|remarkable|laboratory|diagnostic|clinic)\b/i', $name)) {
                return null;
            }

            return 'Dr. ' . $name;
        };

        // 1. Explicit pattern "Radiologist: [Name]"
        if (preg_match('/Radiologist\s*[:\-]?\s*([^,\n\r]+?)(?=\s*(?:License|Lic|PRC|PTR|Date|Impression|Remarks|History|$))/i', $text, $matches)) {
            $candidate = $cleanName($matches[1]);
            if ($candidate) {
                return $candidate;
            }
        }

        // 2. Scan lines from bottom to top
        $lines = preg_split('/\r\n|\r|\n/', $text);
        $lines = array_values(array_filter(array_map('trim', $lines)));

        for ($i = count($lines) - 1; $i >= 0; $i--) {
            $line = $lines[$i];

            // If line is or contains "Radiologist", check previous line:
            // e.g.
            // JANE SMITH, MD
            // Radiologist
            if (preg_match('/^\s*radiologist\s*$/i', $line) && $i > 0) {
                $prevLine = $lines[$i - 1];
                $candidate = $cleanName($prevLine);
                if ($candidate) {
                    return $candidate;
                }
            }

            // If current line has MD / FPCR suffix: e.g. "JANE SMITH, MD", "JUAN DELA CRUZ, MD, FPCR"
            if (preg_match('/[,.-]?\s*\b(?:MD|M\.D\.|FPCR|FPC|DPBR|FACR)\b/i', $line)) {
                $candidate = $cleanName($line);
                if ($candidate) {
                    return $candidate;
                }
            }
        }

        // 3. Fallback to Physician: [Name]
        if (preg_match('/Physician\s*[:\-]?\s*([^,\n\r]+?)(?=\s*(?:History|Date|Age|Sex|Exam|Ref|License|Lic|PRC|PTR|$))/i', $text, $matches)) {
            $candidate = $cleanName($matches[1]);
            if ($candidate) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Parse Complete Blood Count (CBC)
     */
    public function parseCbc(string $text): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $text);
        $lines = array_values(array_filter(array_map('trim', $lines)));

        $date = $this->extractDate($text);
        $bloodType = $this->extractCbcBloodType($lines);
        $hemoglobin = $this->extractCbcHemoglobin($lines);
        $hematocrit = $this->extractCbcHematocrit($lines);
        $wbc = $this->extractCbcWbc($lines);
        $plateletCount = $this->extractCbcPlatelet($lines);

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

    protected function extractCbcBloodType(array $lines): ?string
    {
        $validTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

        for ($i = 0; $i < count($lines); $i++) {
            $line = $lines[$i];
            if (!preg_match('/\b(?:blood\s*(?:type|group|typing)|abo(?:\/?rh)?|abo\s*group|rh(?:esus)?(?:\s*type)?)\b/i', $line)) {
                continue;
            }

            // Same line checks
            $cleaned = str_replace(['"', "'"], ' ', $line);
            if (preg_match('/\b(AB|A|B|O)\s*([+-])(?:\s|$|[.,;])/i', $cleaned, $m)) {
                $type = strtoupper($m[1]) . $m[2];
                if (in_array($type, $validTypes, true)) return $type;
            }
            if (preg_match('/\b(AB|A|B|O)\b\s*(?:Rh(?:D|\(D\))?\s*)?([+-]|positive|negative|pos|neg)\b/i', $cleaned, $m)) {
                $rh = $this->normalizeBloodRh($m[2]);
                $type = strtoupper($m[1]) . $rh;
                if (in_array($type, $validTypes, true)) return $type;
            }

            // Check nearby lines (down up to 8 lines)
            for ($j = $i + 1; $j < min(count($lines), $i + 9); $j++) {
                $nearby = str_replace(['"', "'"], ' ', $lines[$j]);
                if (preg_match('/^\s*(AB|A|B|O)\s*([+-])\s*$/i', $nearby, $m)) {
                    $type = strtoupper($m[1]) . $m[2];
                    if (in_array($type, $validTypes, true)) return $type;
                }
                if (preg_match('/\b(AB|A|B|O)\s*([+-])(?:\s|$|[.,;])/i', $nearby, $m)) {
                    $type = strtoupper($m[1]) . $m[2];
                    if (in_array($type, $validTypes, true)) return $type;
                }
                if (preg_match('/\b(AB|A|B|O)\b\s*(?:Rh(?:D|\(D\))?\s*)?([+-]|positive|negative|pos|neg)\b/i', $nearby, $m)) {
                    $rh = $this->normalizeBloodRh($m[2]);
                    $type = strtoupper($m[1]) . $rh;
                    if (in_array($type, $validTypes, true)) return $type;
                }
            }
        }

        return null;
    }

    protected function normalizeBloodRh(string $val): string
    {
        $v = strtolower(trim(str_replace(['(', ')'], '', $val)));
        if (in_array($v, ['+', 'positive', 'pos', 'reactive', 'rh+', 'rhd+', 'dpositive', 'dpos'], true)) return '+';
        if (in_array($v, ['-', 'negative', 'neg', 'nonreactive', 'rh-', 'rhd-', 'dnegative', 'dneg'], true)) return '-';
        return '';
    }

    protected function extractCbcHemoglobin(array $lines): ?string
    {
        foreach ($lines as $line) {
            if (!preg_match('/\b(?:hemoglobin|hgb|hb)\b/i', $line)) continue;
            if (preg_match('/\b(?:hemoglobin|hgb|hb)\b\s*[:=;\-–—]?\s*([^\s,;:]+)/i', $line, $m)) {
                $token = $m[1];
                if (preg_match('/^\d+(?:\.\d+)?$/', $token)) {
                    $val = (float)$token;
                    if ($val >= 10 && $val <= 300) {
                        return (string)(floor($val) == $val ? (int)$val : round($val, 2));
                    }
                }
            }
        }
        return null;
    }

    protected function extractCbcHematocrit(array $lines): ?string
    {
        foreach ($lines as $line) {
            if (!preg_match('/\b(?:hematocrit|hct|pcv)\b/i', $line)) continue;
            if (preg_match('/\b(?:hematocrit|hct|pcv)\b\s*[:=;\-–—]?\s*([^\s,;:]+)/i', $line, $m)) {
                $token = ltrim($m[1], '.');
                if ($m[1][0] === '.') $token = '0.' . $token;
                if (preg_match('/^\d+(?:\.\d+)?$/', $token)) {
                    $val = (float)$token;
                    if ($val > 5 && $val <= 100) $val = $val / 100;
                    if ($val >= 0.05 && $val <= 1.00) {
                        return sprintf('%.2f', $val);
                    }
                }
            }
        }
        return null;
    }

    protected function extractCbcWbc(array $lines): ?string
    {
        foreach ($lines as $line) {
            if (!preg_match('/\b(?:white\s*blood|wbc(?:\s*count)?|leukocytes)\b/i', $line)) continue;
            if (preg_match('/\b(?:white\s*blood(?:\s*count)?|wbc(?:\s*count)?|leukocytes)\b\s*[:=;\-–—]?\s*([^\s,;:]+)/i', $line, $m)) {
                $token = ltrim($m[1], '.');
                if ($m[1][0] === '.') $token = '0.' . $token;
                if (preg_match('/^\d+(?:\.\d+)?$/', $token)) {
                    $val = (float)$token;
                    if ($val >= 500 && $val <= 100000) $val = $val / 1000;
                    if ($val >= 0.1 && $val <= 200) {
                        return (string)(floor($val) == $val ? (int)$val : round($val, 2));
                    }
                }
            }
        }
        return null;
    }

    protected function extractCbcPlatelet(array $lines): ?string
    {
        foreach ($lines as $line) {
            if (!preg_match('/\b(?:platelet(?:\s*count)?|plt)\b/i', $line)) continue;
            if (preg_match('/\b(ADEQUATE|THROMBOCYTOPENIA|THROMBOCYTOSIS)\b/i', $line, $m)) {
                return ucfirst(strtolower($m[1]));
            }
            if (preg_match('/\b(?:platelet(?:\s*count)?|plt)\b\s*[:=;\-–—]?\s*([^\s;:]+)/i', $line, $m)) {
                $raw = str_replace(',', '', $m[1]);
                if (preg_match('/^\d+(?:\.\d+)?$/', $raw)) {
                    $val = (float)$raw;
                    if ($val > 10000) $val = $val / 1000;
                    if ($val >= 10 && $val <= 2000) {
                        return (string)round($val);
                    }
                }
            }
        }
        return null;
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
        $lines = preg_split('/\r\n|\r|\n/', $text);
        $lines = array_values(array_filter(array_map('trim', $lines)));

        // 1. Released date / report date / exam date specifically
        foreach ($lines as $line) {
            if (preg_match('/\b(?:birth|dob|bday|birthdate)\b/i', $line)) {
                continue;
            }
            if (preg_match('/\b(?:released|release|reported|received|result\s*date|exam(?:ined)?\s*date)\b/i', $line)) {
                $d = $this->parseDateCandidate($line);
                if ($d) return $d;
            }
        }

        // 2. Generic Date:
        foreach ($lines as $line) {
            if (preg_match('/\b(?:birth|dob|bday|birthdate)\b/i', $line)) {
                continue;
            }
            if (preg_match('/\bdate\b/i', $line)) {
                $d = $this->parseDateCandidate($line);
                if ($d) return $d;
            }
        }

        // 3. Any line not birthdate
        foreach ($lines as $line) {
            if (preg_match('/\b(?:birth|dob|bday|birthdate)\b/i', $line)) {
                continue;
            }
            $d = $this->parseDateCandidate($line);
            if ($d) return $d;
        }

        return null;
    }

    protected function parseDateCandidate(string $text): ?string
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
