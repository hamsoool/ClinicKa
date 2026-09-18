<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
        }

        if ($user->is_banned) {
            return response()->json([
                'error' => 'This account is not available. Contact the administrator for assistance.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Super Admin has access to all roles
        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        // Staff, Doctors, Nurses, and Admins have access to staff and doctor endpoints
        if ($user->isStaff() && (in_array('staff', $roles, true) || in_array('doctor', $roles, true))) {
            return $next($request);
        }

        // Admins and Super Admins have access to admin endpoints
        if ($user->isAdmin() && in_array('admin', $roles, true)) {
            return $next($request);
        }

        if (! in_array($user->role, $roles, true)) {
            return response()->json([
                'error' => 'Forbidden. Required role: ' . implode(' or ', $roles),
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
