<?php

namespace App\Http\Middleware;

use App\Services\CryptoService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class EncryptPayloadMiddleware
{
    public function __construct(protected CryptoService $crypto)
    {
    }

    /**
     * Handle an outgoing response.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only encrypt JSON responses
        if ($response instanceof JsonResponse) {
            // Check for explicit exemption (e.g. streaming, health check, or unencrypted debug)
            if ($request->header('X-Skip-Encryption') === 'true' || $request->is('api/health') || $request->is('up')) {
                return $response;
            }

            try {
                $originalData = $response->getData(true);
                $encryptedEnvelope = $this->crypto->encrypt($originalData);

                $response->setData($encryptedEnvelope);
                $response->headers->set('X-Encrypted-Payload', '1');
            } catch (Throwable $e) {
                // If encryption fails, fallback to error JSON
                return response()->json([
                    'error' => 'Response encryption failed',
                    'message' => $e->getMessage(),
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            }
        }

        return $response;
    }
}
