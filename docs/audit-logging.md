# Audit Logging

ClinicKa stores security-relevant activity in the append-only `audit_logs` table. Audit records are written through `App\Services\AuditService`; the service derives the actor and request context from Laravel Sanctum whenever a request user exists, normalizes event names, assigns a category, and allowlists metadata keys.

## Visibility

- Students can see only limited activity for their own student record through the record-history endpoint.
- Clinic staff can see limited activity for records they are already authorized to access.
- Admins can query operational audit events at `/api/v1/admin/audit-logs`.
- Super admins can query the complete security and system audit stream at `/api/v1/super-admin/audit-logs`.

All audit endpoints require Sanctum authentication and server-side role checks. Queries are paginated and filters are validated on the server.

## Audited events

Authentication events include `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_CHANGE_FAILED`, and `PASSWORD_CHANGED`. Medical workflow events include `VIEW_MEDICAL_RECORD`, `UPDATE_CLEARANCE_STATUS`, `UPDATE_PHYSICAL_EXAM`, `VIEW_MEDICAL_DOCUMENT`, `FILE_UPLOAD`, and existing clearance, OCR, profile, announcement, and account-management events. Invalid or expired document streaming tickets and denied record/document access are recorded with `result = DENIED` where the target is known.

## Append-only behavior

`AuditLog` rejects model updates and deletes. The application exposes no update, delete, or client-created audit endpoint. The migration intentionally does not add foreign keys to actor or target records so accountability history remains available when an account or resource changes.

## Privacy

Do not put diagnoses, laboratory values, medical history, document contents, passwords, tokens, encryption keys, or request payloads in audit metadata. `AuditService` accepts only the keys in `config/audit.php` and removes sensitive key patterns. Audit details are themselves restricted information and should be exposed only through the role-appropriate endpoint.

## Adding an event

When implementing a new security-sensitive operation:

1. Authorize the operation through the existing controller, middleware, or policy.
2. Perform the operation through the existing service/controller architecture.
3. Record the event with `AuditService` after a successful operation, or `recordDenied` for a denied attempt.
4. Let the authenticated request provide the actor and role; never accept either from the client.
5. Use a fixed machine-readable action name and a target identifier, not medical content.
6. Add only non-sensitive metadata keys that are explicitly allowlisted in `config/audit.php`.

Audit writes are treated as critical by default. A protected operation fails if its accountability record cannot be written, and the failure is sent to the application critical log.