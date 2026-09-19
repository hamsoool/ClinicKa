# Graph Report - ClinicKa  (2026-09-19)

## Corpus Check
- 201 files · ~478,219 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 26, .css 5, .example 2)

## Summary
- 2076 nodes · 5631 edges · 103 communities (87 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3037fc13`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.tsx
- staff-workflow-query.ts
- api.ts
- dependencies
- route-modules.ts
- user-accounts.tsx
- medical-record-pdf-export.tsx
- package.json
- Illuminate\Http\Request
- reports-dashboard.tsx
- Illuminate\Database\Eloquent\Model
- composer.json
- record-review.tsx
- useAuth
- use-student-medical-form.ts
- submission-dashboard-cards.tsx
- certificates.tsx
- utils.ts
- FileRecord
- Student
- role-selection.tsx
- apiRequest
- CryptoService
- types.ts
- system-settings.tsx
- constants.ts
- user-accounts-helpers.tsx
- normalizeStorageFileUrl
- User
- student-profile-form-card.tsx
- student/layout.tsx
- StaffRecordReview
- verify-ocr-parsers.cjs
- announcements-management.tsx
- password-policy.ts
- student-records-query.ts
- staff-workspace-preferences.ts
- compilerOptions
- Submission
- OcrService
- submissions.tsx
- medical-clearance-preview.tsx
- routes.tsx
- App.tsx
- react
- cn
- use-swipe-navigation.ts
- SystemHealthCheckCommand.php
- SystemSetting
- 0001_01_01_000000_create_users_table.php
- getMe
- medical-record-preview.tsx
- project-skeletons.tsx
- updateAssessmentField
- inline-pdf-viewer.tsx
- staff/dashboard.tsx
- admin-workflow-query.ts
- admin/dashboard.tsx
- password-strength-meter.tsx
- createRecordForm
- profile.tsx
- devDependencies
- getPasswordPolicyMessage
- StorageController
- AuthAccessPage
- SubmissionController
- createClearanceForm
- AppServiceProvider.php
- vite.config.ts
- student-profile-assets-query.ts
- student-year.ts
- TestCase
- scripts
- StaffSubmissions
- createAssessmentForm
- auth-access.tsx
- logging.php
- sanctum.php
- peerDependenciesMeta
- console.php
- ExampleTest
- bootstrap/app.php
- artisan
- pnpm
- peerDependencies
- setStoredSession
- upload-activity.ts
- ClinicKa
- login-prefetch.ts
- academic-year-query.ts
- backend/README.md
- getActiveAjaxRefetchInterval
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 108 edges
2. `react` - 72 edges
3. `StaffRecordReview()` - 66 edges
4. `useAuth()` - 51 edges
5. `useStudentMedicalForm()` - 51 edges
6. `Profile` - 46 edges
7. `lucide-react` - 46 edges
8. `AuditLog` - 41 edges
9. `apiRequest()` - 41 edges
10. `AuthProvider()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `AlertDialogOverlay` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/alert-dialog.tsx → src/app/components/ui/utils.ts
- `StudentAnnouncements()` --indirect_call--> `getStudentAnnouncements()`  [INFERRED]
  src/app/pages/student/announcements.tsx → src/app/lib/api.ts
- `StudentDashboard()` --indirect_call--> `getStudentAnnouncements()`  [INFERRED]
  src/app/pages/student/dashboard.tsx → src/app/lib/api.ts
- `adminUserAccountsQueryOptions()` --indirect_call--> `getUserAccounts()`  [INFERRED]
  src/app/pages/admin/admin-workflow-query.ts → src/app/lib/api.ts
- `adminSystemSettingsQueryOptions()` --indirect_call--> `getAdminSystemSettings()`  [INFERRED]
  src/app/pages/admin/admin-workflow-query.ts → src/app/lib/api.ts

## Import Cycles
- None detected.

## Communities (103 total, 16 thin omitted)

### Community 0 - "auth.tsx"
Cohesion: 0.08
Nodes (57): authenticateWithPassword(), AuthSession, clearSupabaseAuthSession(), getCurrentAuthUser(), getSessionPolicy(), hasServerPasswordSetupCompleted(), markServerPasswordSetupCompleted(), rejectUnauthorizedGoogleAccount() (+49 more)

### Community 1 - "staff-workflow-query.ts"
Cohesion: 0.19
Nodes (21): getStaffApprovedStudents(), getStaffCertificateRecords(), getStaffDashboardOverview(), getSubmission(), shouldFallbackToRest(), StaffApprovedStudentFilters, StaffSubmissionSummaryFilters, invalidateStaffWorkflowQueries() (+13 more)

### Community 2 - "api.ts"
Cohesion: 0.03
Nodes (79): AcademicYearSetting, AdminCreateAccountInput, AdminCreateStaffInput, assertMedicalRecordDateInRange(), assertUploadFileSize(), AUTH_STORAGE_KEY, AuthChangeEvent, AuthStateChangeCallback (+71 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (72): dependencies, class-variance-authority, clsx, cmdk, date-fns, dotenv, embla-carousel-react, @emotion/react (+64 more)

### Community 4 - "route-modules.ts"
Cohesion: 0.07
Nodes (25): AppRole, loadAdminAnnouncements(), loadAdminReports(), loadAdminSystemSettings(), loadAdminUserAccounts(), loadCheckEmailPage(), loadStaffAnnouncements(), loadStaffCertificates() (+17 more)

### Community 5 - "user-accounts.tsx"
Cohesion: 0.16
Nodes (22): @tanstack/react-query, PasswordStrengthMeter(), buildPdfPreviewUrl(), getDownloadFileName(), getFilePreviewType(), Props, SubmittedFilePreview, Dialog() (+14 more)

### Community 6 - "medical-record-pdf-export.tsx"
Cohesion: 0.10
Nodes (29): @react-pdf/renderer, assetUrl(), buildBestRecordBySlot(), buildSlotPages(), CERTIFICATE_COPY_TYPES, CertificateCopy(), CertificateField(), CLEARANCE_SIGNATORY_NAMES (+21 more)

### Community 7 - "package.json"
Cohesion: 0.03
Nodes (60): description, name, private, type, version, clsx, cmdk, date-fns (+52 more)

### Community 8 - "Illuminate\Http\Request"
Cohesion: 0.07
Nodes (14): AdminController, AnnouncementController, Response, AuthController, CertificateController, NotificationController, Announcement, ArchivedAccount (+6 more)

### Community 9 - "reports-dashboard.tsx"
Cohesion: 0.05
Nodes (57): abbreviateCourse(), buildReportingTermRange(), DEPARTMENT_COLORS, DEPARTMENTS, formatCertificateStatus(), formatLabStatus(), formatPhysicalExamStatus(), formatReportDate() (+49 more)

### Community 10 - "Illuminate\Database\Eloquent\Model"
Cohesion: 0.07
Nodes (15): App\Models\Notification, App\Models\NotificationState, Certificate, EmergencyContact, LabCbc, LabChestXray, LabUrinalysis, MedicalHistory (+7 more)

### Community 11 - "composer.json"
Cohesion: 0.04
Nodes (48): pestphp/pest-plugin, php-http/discovery, autoload, autoload-dev, psr-4, psr-4, config, allow-plugins (+40 more)

### Community 12 - "record-review.tsx"
Cohesion: 0.04
Nodes (41): CbcOcrExtraction, ChestXrayOcrExtraction, StaffSignatureAsset, UrinalysisOcrExtraction, STAFF_CLEARANCE_MUTATION_KEY, STAFF_REVIEW_MUTATION_KEY, AssessmentForm, AssessmentValidationErrors (+33 more)

### Community 13 - "useAuth"
Cohesion: 0.19
Nodes (29): PortalPageSkeleton(), formatAcademicYearLabel(), getDefaultAcademicYear(), getLatestRecordForAcademicYear(), getNextSubmissionSlot(), getRecordAcademicYear(), getSubmissionSlotLabel(), inferAcademicYearFromDate() (+21 more)

### Community 14 - "use-student-medical-form.ts"
Cohesion: 0.10
Nodes (45): uploadFile(), src_app_pages_student_medical_form_types_labuploadkind, addressesMatch(), buildInitialFormData(), buildOperationDetails(), calculateAgeFromBirthdate(), calculateBmi(), CLINIC_INTERNAL_LAB_SOURCE_ALIASES (+37 more)

### Community 15 - "submission-dashboard-cards.tsx"
Cohesion: 0.05
Nodes (62): ANALYTICS_VIEW_LABELS, AnalyticsDatum, AnalyticsSeries, AnalyticsView, buildAnalyticsData(), buildDonutData(), buildNoActionStudents(), buildStatusMetrics() (+54 more)

### Community 16 - "certificates.tsx"
Cohesion: 0.10
Nodes (27): InlinePdfViewer(), MedicalClearancePreview, MedicalRecordPreview, Button, Skeleton(), Tabs(), TabsContent(), TabsList() (+19 more)

### Community 17 - "utils.ts"
Cohesion: 0.29
Nodes (6): class-variance-authority, @radix-ui/react-slot, Badge(), badgeVariants, Calendar(), CalendarProps

### Community 18 - "FileRecord"
Cohesion: 0.11
Nodes (7): OcrController, FileRecord, StorageService, Illuminate\Http\UploadedFile, Illuminate\Support\Facades\Http, Illuminate\Support\Facades\Log, Illuminate\Support\Facades\Storage

### Community 19 - "Student"
Cohesion: 0.15
Nodes (8): ProfileController, Controller, StaffUser, Student, Illuminate\Support\Facades\Cache, Illuminate\Support\Facades\Hash, Illuminate\Support\Facades\Mail, Illuminate\Validation\ValidationException

### Community 20 - "role-selection.tsx"
Cohesion: 0.16
Nodes (13): @radix-ui/react-accordion, Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), activeGridStyle, baseGridStyle, navLinks (+5 more)

### Community 21 - "apiRequest"
Cohesion: 0.10
Nodes (31): apiRequest(), ApiRequestError, changePasswordOnServer(), clearStudentNotifications(), deleteArchivedUserAccount(), deleteStudentNotification(), getStudentNotifications(), getStudentNotificationState() (+23 more)

### Community 22 - "CryptoService"
Cohesion: 0.12
Nodes (13): DecryptPayloadMiddleware, Response, EncryptPayloadMiddleware, Response, Response, RoleMiddleware, SecurityHeadersMiddleware, CryptoService (+5 more)

### Community 23 - "types.ts"
Cohesion: 0.17
Nodes (11): LAB_UPLOAD_TYPES, LabUploadType, STUDENT_PROFILE_ASSET_UPLOAD_TYPES, StudentProfileAssetUploadType, MEDICAL_CONDITIONS, BmiCategory, EmergencyContact, MedicalConditionKey (+3 more)

### Community 24 - "system-settings.tsx"
Cohesion: 0.15
Nodes (20): react-router, PortalShellProps, SettingsLogoutCardProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription() (+12 more)

### Community 25 - "constants.ts"
Cohesion: 0.11
Nodes (30): buildProfileFormState(), normalizeProfileValue(), StaffSettings(), DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT, DATA_PRIVACY_CONSENT_BODY, DATA_PRIVACY_RIGHTS_NOTICE, DEFAULT_MEDICAL_HISTORY, DEPARTMENTS (+22 more)

### Community 26 - "user-accounts-helpers.tsx"
Cohesion: 0.12
Nodes (24): AdminUserAccount, ArchivedUserAccount, archiveUserAccount(), restoreArchivedUserAccount(), AdminUserAccounts(), deriveStudentIdFromEmail(), CLINIC_STAFF_ROLE_FILTER, CsvAccountRow (+16 more)

### Community 27 - "normalizeStorageFileUrl"
Cohesion: 0.13
Nodes (33): buildCloudinaryDeliveryUrl(), buildLabFileAssetFromRow(), buildStaffSignatureAssetFromRow(), buildStudentProfileAssetFromRow(), byId(), findGenericLabFile(), findLabFileByHint(), getAccessToken() (+25 more)

### Community 28 - "User"
Cohesion: 0.13
Nodes (13): User, UserFactory, DatabaseSeeder, Illuminate\Database\Console\Seeds\WithoutModelEvents, Illuminate\Database\Eloquent\Attributes\Fillable, Illuminate\Database\Eloquent\Attributes\Hidden, Illuminate\Database\Eloquent\Factories\Factory, Illuminate\Database\Eloquent\Factories\HasFactory (+5 more)

### Community 29 - "student-profile-form-card.tsx"
Cohesion: 0.19
Nodes (17): formatDateInputValue(), formatIsoToMdY(), formatReadOnlyDate(), formatReadOnlySex(), formatReadOnlyYearLevel(), getMaxBirthdateIso(), MONTH_OPTIONS, parseDateInputValue() (+9 more)

### Community 30 - "student/layout.tsx"
Cohesion: 0.14
Nodes (21): formatEmailName(), getInitials(), isRouteActive(), PortalNavItem, PortalShell(), PortalTopAction, getRoleLabel(), isDoctorPosition() (+13 more)

### Community 31 - "StaffRecordReview"
Cohesion: 0.10
Nodes (34): extractCbcFields(), extractChestXrayFindings(), extractUrinalysisFields(), buildEmptyStaffSignature(), countVerifiedConditions(), getOcrStatusClass(), getStatusBadge(), isAllowedSignatureImage() (+26 more)

### Community 32 - "verify-ocr-parsers.cjs"
Cohesion: 0.11
Nodes (14): ref_node_assert, ref_node_fs, ref_node_module, ref_node_path, typescript, assert, fs, loadParserModule() (+6 more)

### Community 33 - "announcements-management.tsx"
Cohesion: 0.11
Nodes (26): AnnouncementUpsertInput, createAnnouncement(), deleteAnnouncement(), getManagedAnnouncements(), isMissingExaminedBySignatureUrlColumnError(), isMissingSignatoryNameColumnError(), issueCertificateRecordViaServer(), persistCertificateRecord() (+18 more)

### Community 34 - "password-policy.ts"
Cohesion: 0.20
Nodes (16): zxcvbn, buildUserTokens(), getEmailLocalPart(), getPasswordCharacterCount(), getPasswordStrengthResult(), getRegistrationPasswordMessage(), getStrengthSuggestions(), isPasswordLongEnough() (+8 more)

### Community 35 - "student-records-query.ts"
Cohesion: 0.42
Nodes (8): getStudentRecords(), getStudentRecordSummaries(), mapStudentRecordSummary(), invalidateStudentRecordsQuery(), normalizeStudentId(), studentRecordsQueryKey(), StudentRecordsQueryMode, studentRecordsQueryOptions()

### Community 36 - "staff-workspace-preferences.ts"
Cohesion: 0.16
Nodes (17): AUTO_REFRESH_INTERVALS, CERTIFICATE_VIEWS, DASHBOARD_QUEUE_TABS, getDefaultStaffWorkspacePreferences(), getStorageKey(), isClinicDoctor(), loadStaffWorkspacePreferences(), normalizeStaffWorkspacePreferences() (+9 more)

### Community 37 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+9 more)

### Community 38 - "Submission"
Cohesion: 0.14
Nodes (5): Response, PostgrestCompatController, Submission, Illuminate\Database\Eloquent\Relations\HasMany, Illuminate\Database\Eloquent\Relations\HasOne

### Community 40 - "submissions.tsx"
Cohesion: 0.16
Nodes (20): getVisiblePages(), ListPagination(), ListPaginationProps, Input(), Select(), SelectContent(), SelectItem(), SelectTrigger() (+12 more)

### Community 41 - "medical-clearance-preview.tsx"
Cohesion: 0.14
Nodes (11): CLEARANCE_SIGNATORY_NAMES, ClearanceCopy(), COPY_TYPES, formatCertificateIssuedDate(), matchClearanceSignatoryName(), MedicalClearancePreviewBase, normalizeSignatoryName(), Props (+3 more)

### Community 42 - "routes.tsx"
Cohesion: 0.07
Nodes (30): AdminAnnouncements, AdminDashboard, AdminLayout, AdminReports, AdminSystemSettings, AdminUserAccounts, CheckEmailPage, CreatePasswordPage (+22 more)

### Community 43 - "App.tsx"
Cohesion: 0.17
Nodes (12): next-themes, react-dom, ref_virtual_pwa_register, App(), Toaster(), ToasterProps, appQueryClient, router (+4 more)

### Community 44 - "react"
Cohesion: 0.18
Nodes (20): lucide-react, react, sonner, PasswordChangeCard(), PasswordChangeCardProps, Card(), CardContent(), CardDescription() (+12 more)

### Community 45 - "cn"
Cohesion: 0.08
Nodes (32): @radix-ui/react-dropdown-menu, @radix-ui/react-popover, formatNotificationTimestamp(), notificationDateFormatter, StudentNotificationMenu(), StudentNotificationMenuProps, CardAction(), DialogOverlay (+24 more)

### Community 46 - "use-swipe-navigation.ts"
Cohesion: 0.21
Nodes (16): BLOCK_ROUTES, cachePageDom(), cleanStyles(), createBackdrop(), createEdgeShadow(), createTabPreview(), findActiveIndex(), isBlockedRoute() (+8 more)

### Community 47 - "SystemHealthCheckCommand.php"
Cohesion: 0.23
Nodes (7): MigrateSupabaseCommand, ServerBackupCommand, ServerRestoreCommand, SystemHealthCheckCommand, Illuminate\Console\Command, Illuminate\Support\Facades\DB, ZipArchive

### Community 49 - "0001_01_01_000000_create_users_table.php"
Cohesion: 0.19
Nodes (3): Illuminate\Database\Migrations\Migration, Illuminate\Database\Schema\Blueprint, Illuminate\Support\Facades\Schema

### Community 50 - "getMe"
Cohesion: 0.23
Nodes (15): deriveNamePartsFromUser(), deriveStudentIdFromEmail(), getMe(), getMeCacheKey(), invalidateMeCache(), isGCDomainEmail(), isGoogleAuthUser(), isValidStudentRegistrationEmail() (+7 more)

### Community 51 - "medical-record-preview.tsx"
Cohesion: 0.11
Nodes (21): buildBestRecordBySlot(), buildSlotPages(), CLEARANCE_SIGNATORY_NAMES, EXAM_FIELD_MAP, EXAM_ROWS, formatLocalPhone(), formatRadiologistNameWithDr(), getExamCompletenessScore() (+13 more)

### Community 52 - "project-skeletons.tsx"
Cohesion: 0.25
Nodes (4): PortalPageSkeletonVariant, PortalShellSkeleton(), PublicPageSkeleton(), PublicSkeletonVariant

### Community 53 - "updateAssessmentField"
Cohesion: 0.20
Nodes (12): getPhysicalExamFieldValidationError(), isPhysicalExamRequiredField(), isVisualAcuitySelectValue(), normalizeCountToX10Power9(), normalizeCountToX10Power9Whole(), sanitizeFractionLikeInput(), sanitizeNumericWithLimits(), sanitizeSafeText() (+4 more)

### Community 54 - "inline-pdf-viewer.tsx"
Cohesion: 0.14
Nodes (13): html2canvas, jspdf, react-pdf, InlinePdfViewerProps, convertImageToDataUrl(), createPdfFromElement(), DomPdfPageFormat, getCanvasScale() (+5 more)

### Community 55 - "staff/dashboard.tsx"
Cohesion: 0.33
Nodes (10): abbreviateCourse(), abbreviateDepartment(), formatDate(), formatEmailName(), formatSubmittedYearLevel(), getStatusLabel(), getStatusStyles(), StaffDashboard() (+2 more)

### Community 56 - "admin-workflow-query.ts"
Cohesion: 0.15
Nodes (25): getArchivedUserAccounts(), getOcrAnalytics(), getStaffUsers(), getSubmissions(), sendSettingsChangeOtp(), adminAnalyticsQueryKey(), adminArchivedAccountsQueryKey(), adminArchivedAccountsQueryOptions() (+17 more)

### Community 57 - "admin/dashboard.tsx"
Cohesion: 0.18
Nodes (15): recharts, useAdminAnalyticsQuery(), useAdminUserAccountsQuery(), AdminDashboard(), dateFormatter, dateTimeFormatter, formatDate(), formatDateTime() (+7 more)

### Community 58 - "password-strength-meter.tsx"
Cohesion: 0.25
Nodes (8): fillClasses, PasswordStrengthMeterProps, progressWidths, toneClasses, MIN_PASSWORD_LENGTH, PasswordPolicyUserInputs, PasswordSetupScreen(), PasswordSetupScreenProps

### Community 59 - "createRecordForm"
Cohesion: 0.29
Nodes (11): createEmptyMedicalHistory(), createRecordForm(), normalizeSexValue(), sanitizeAddress(), sanitizeContactNumber(), sanitizeEmergencyName(), sanitizeLettersOnly(), sanitizeMiddleInitial() (+3 more)

### Community 60 - "profile.tsx"
Cohesion: 0.16
Nodes (12): FilePickerButton(), FilePickerButtonProps, PortalPageIntro(), PortalPageIntroProps, SettingsLogoutCard(), dateFormatter, formatDate(), StudentAnnouncements() (+4 more)

### Community 61 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+2 more)

### Community 62 - "getPasswordPolicyMessage"
Cohesion: 0.13
Nodes (17): archiveSuperAdminAdministrator(), createAdminAccount(), createAdminStaff(), createSuperAdminAdministrator(), restoreSuperAdminAdministrator(), sendSuperAdminCreateAdminOtp(), getPasswordLengthMessage(), getPasswordPolicyMessage() (+9 more)

### Community 63 - "StorageController"
Cohesion: 0.27
Nodes (3): Response, StorageController, Illuminate\Support\Facades\Route

### Community 64 - "AuthAccessPage"
Cohesion: 0.57
Nodes (7): getPasswordResetCooldownRemaining(), getPasswordResetCooldownStorageKey(), sendPasswordResetEmail(), AuthAccessPage(), formatCooldown(), handleForgotPassword(), openForgotPasswordDialog()

### Community 66 - "createClearanceForm"
Cohesion: 0.28
Nodes (9): createClearanceForm(), isClearanceSignatoryName(), matchClearanceSignatoryName(), normalizeClearancePurposes(), normalizeClearanceSignatoryName(), normalizeSignatoryNameForMatch(), normalizeSingleClearancePurpose(), sanitizeLicenseNo() (+1 more)

### Community 67 - "AppServiceProvider.php"
Cohesion: 0.29
Nodes (4): AppServiceProvider, Illuminate\Cache\RateLimiting\Limit, Illuminate\Support\Facades\RateLimiter, Illuminate\Support\ServiceProvider

### Community 68 - "vite.config.ts"
Cohesion: 0.29
Nodes (6): dotenv, ref_path, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 69 - "student-profile-assets-query.ts"
Cohesion: 0.48
Nodes (6): StudentProfileAssets, EMPTY_STUDENT_PROFILE_ASSETS, normalizeId(), studentProfileAssetsQueryKey(), studentProfileAssetsQueryOptions(), useStudentProfileAssetsQuery()

### Community 70 - "student-year.ts"
Cohesion: 0.33
Nodes (9): getOrdinalSuffix(), getYearLevelLabel(), inferStudentYearLevel(), isCurrentSubmissionYear(), MAX_ACADEMIC_YEAR_LEVEL, normalizeYearLevel(), resolveStudentYearLevel(), StudentYearSource (+1 more)

### Community 71 - "TestCase"
Cohesion: 0.47
Nodes (3): ExampleTest, TestCase, Illuminate\Foundation\Testing\TestCase

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, typecheck, verify:ocr

### Community 73 - "StaffSubmissions"
Cohesion: 0.24
Nodes (10): getStaffSubmissionSummaries(), normalizeSummaryFilters(), staffSubmissionSummariesQueryKey(), staffSubmissionSummariesQueryOptions(), useStaffSubmissionSummariesQuery(), formatStudentYearLevel(), formatTimestamp(), getStatusFilterLabel() (+2 more)

### Community 74 - "createAssessmentForm"
Cohesion: 0.20
Nodes (10): calculateBmi(), createAssessmentForm(), formatDateInputValue(), getMedicalRecordDateBounds(), getMedicalRecordDateValidationMessage(), getTodayDateInputValue(), normalizeVisualAcuitySelectValue(), sanitizeVisualAcuityText() (+2 more)

### Community 75 - "auth-access.tsx"
Cohesion: 0.21
Nodes (11): @radix-ui/react-dialog, PASSWORD_RESET_COOLDOWN_SECONDS, UserRole, getHomePath(), CONTACT_EMAIL, LegalSection, POLICY_UPDATED_AT, privacySections (+3 more)

### Community 76 - "logging.php"
Cohesion: 0.40
Nodes (4): Monolog\Handler\NullHandler, Monolog\Handler\StreamHandler, Monolog\Handler\SyslogUdpHandler, Monolog\Processor\PsrLogMessageProcessor

### Community 77 - "sanctum.php"
Cohesion: 0.40
Nodes (4): Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Foundation\Http\Middleware\ValidateCsrfToken, Laravel\Sanctum\Http\Middleware\AuthenticateSession, Laravel\Sanctum\Sanctum

### Community 78 - "peerDependenciesMeta"
Cohesion: 0.40
Nodes (5): peerDependenciesMeta, react, react-dom, optional, optional

### Community 79 - "console.php"
Cohesion: 0.50
Nodes (3): Illuminate\Foundation\Inspiring, Illuminate\Support\Facades\Artisan, Illuminate\Support\Facades\Schedule

### Community 81 - "bootstrap/app.php"
Cohesion: 0.40
Nodes (3): Illuminate\Foundation\Application, Illuminate\Foundation\Configuration\Exceptions, Illuminate\Foundation\Configuration\Middleware

### Community 83 - "pnpm"
Cohesion: 0.67
Nodes (3): vite, pnpm, overrides

### Community 84 - "peerDependencies"
Cohesion: 0.67
Nodes (3): peerDependencies, react, react-dom

### Community 85 - "setStoredSession"
Cohesion: 0.19
Nodes (19): authRequest(), clearStoredSession(), getNowUnixSeconds(), getStoredSession(), getSupabaseAuthSession(), getUserByToken(), getValidAccessToken(), invalidateStudentProfileAssetsCache() (+11 more)

### Community 86 - "upload-activity.ts"
Cohesion: 0.33
Nodes (6): beginTrackedUpload(), emitUploadActivityChange(), getActiveUploadCount(), listeners, subscribeToUploadActivity(), UploadActivityListener

### Community 97 - "ClinicKa"
Cohesion: 0.13
Nodes (14): 1. Database Setup, 2. Backend Setup (Laravel), 3. Frontend Setup (React / Vite), ClinicKa, Core Technologies, Directory Structure, Disclaimer, Environment Configuration (+6 more)

### Community 98 - "login-prefetch.ts"
Cohesion: 0.28
Nodes (15): AuthMe, getAnalytics(), getStudentAnnouncements(), inferRoleFromEmail(), normalizeEmail(), prefetchLikelyPortalRoutes(), prefetchPortalExperience(), prefetchRouteData() (+7 more)

### Community 100 - "academic-year-query.ts"
Cohesion: 0.20
Nodes (15): getAcademicYearRange(), normalizeAcademicYear(), normalizeSubmissionSlot(), academicYearQueryKey(), academicYearQueryOptions(), activeAcademicYearQueryOptions(), useActiveAcademicYearSettingsQuery(), formatAcademicYearSettingValue() (+7 more)

### Community 101 - "backend/README.md"
Cohesion: 0.25
Nodes (7): About Laravel, Agentic Development, Code of Conduct, Contributing, Learning Laravel, License, Security Vulnerabilities

### Community 102 - "getActiveAjaxRefetchInterval"
Cohesion: 0.46
Nodes (6): getActiveAjaxRefetchInterval(), getSuperAdminAdministrators(), invalidateSuperAdminWorkflowQueries(), superAdminAdministratorsQueryKey(), superAdminAdministratorsQueryOptions(), useSuperAdminAdministratorsQuery()

## Knowledge Gaps
- **491 isolated node(s):** `$schema`, `name`, `type`, `description`, `keywords` (+486 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 671 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `auth.tsx`, `user-accounts.tsx`, `medical-record-pdf-export.tsx`, `package.json`, `reports-dashboard.tsx`, `record-review.tsx`, `useAuth`, `use-student-medical-form.ts`, `submission-dashboard-cards.tsx`, `certificates.tsx`, `utils.ts`, `role-selection.tsx`, `apiRequest`, `system-settings.tsx`, `user-accounts-helpers.tsx`, `student-profile-form-card.tsx`, `student/layout.tsx`, `announcements-management.tsx`, `submissions.tsx`, `medical-clearance-preview.tsx`, `routes.tsx`, `App.tsx`, `cn`, `use-swipe-navigation.ts`, `medical-record-preview.tsx`, `inline-pdf-viewer.tsx`, `staff/dashboard.tsx`, `admin/dashboard.tsx`, `password-strength-meter.tsx`, `profile.tsx`, `auth-access.tsx`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `user-accounts.tsx`, `package.json`, `reports-dashboard.tsx`, `record-review.tsx`, `useAuth`, `submission-dashboard-cards.tsx`, `certificates.tsx`, `utils.ts`, `role-selection.tsx`, `system-settings.tsx`, `student-profile-form-card.tsx`, `student/layout.tsx`, `submissions.tsx`, `cn`, `inline-pdf-viewer.tsx`, `staff/dashboard.tsx`, `admin/dashboard.tsx`, `password-strength-meter.tsx`, `profile.tsx`, `auth-access.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `type` to the rest of the system?**
  _491 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `auth.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08022598870056497 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03442340791738382 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.027777777777777776 - nodes in this community are weakly interconnected._