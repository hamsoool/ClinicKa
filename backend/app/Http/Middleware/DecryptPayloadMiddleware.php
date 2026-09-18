<?php

namespace App\Http\Middleware;

use App\Services\CryptoService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DecryptPayloadMiddleware
{
    public function __construct(protected CryptoService $crypto)
    {
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if request body contains an encrypted envelope
        $input = $request->all();

        if ($this->crypto->isEnvelope($input)) {
            try {
                $decrypted = $this->crypto->decrypt($input);

                if (is_array($decrypted)) {
                    // Replace request inputs with the decrypted data
                    $request->replace($decrypted);
                } else {
                    $request->merge(['_decrypted_payload' => $decrypted]);
                }

                // Mark request as decrypted
                $request->attributes->set('is_payload_encrypted', true);
            } catch (Throwable $e) {
                return response()->json([
                    'error' => 'Payload decryption failed',
                    'message' => $e->getMessage(),
                ], Response::HTTP_BAD_REQUEST);
            }
        }

        return $next($request);
    }
}
