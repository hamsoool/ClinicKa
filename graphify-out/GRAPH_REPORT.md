# Graph Report - ClinicKa  (2026-09-19)

## Corpus Check
- 201 files · ~478,083 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 26, .css 5, .example 2)

## Summary
- 2073 nodes · 5625 edges · 99 communities (81 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3037fc13`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.tsx
- Announcement
- api.ts
- dependencies
- route-modules.ts
- dialog.tsx
- medical-record-pdf-export.tsx
- package.json
- Illuminate\Http\Request
- reports-dashboard.tsx
- Illuminate\Database\Eloquent\Model
- composer.json
- record-review.tsx
- medical-form.tsx
- use-student-medical-form.ts
- submission-dashboard-cards.tsx
- user-accounts.tsx
- react
- FileRecord
- AuditLog
- role-selection.tsx
- apiRequest
- CryptoService
- record-types.ts
- check-email.tsx
- profile.tsx
- user-accounts-helpers.tsx
- normalizeStorageFileUrl
- User
- student-profile-form-card.tsx
- useAuth
- StaffRecordReview
- verify-ocr-parsers.cjs
- announcements-management.tsx
- password-policy.ts
- student-records-query.ts
- staff-workspace-preferences.ts
- compilerOptions
- Submission
- OcrService
- certificates.tsx
- medical-clearance-preview.tsx
- routes.tsx
- App.tsx
- system-settings.tsx
- cn
- use-swipe-navigation.ts
- SystemHealthCheckCommand.php
- SystemSetting
- 0001_01_01_000000_create_users_table.php
- getMe
- ReportsDashboard
- student/dashboard.tsx
- updateAssessmentField
- dom-pdf-export.ts
- staff/dashboard.tsx
- staff-workflow-query.ts
- excel-export.ts
- password-strength-meter.tsx
- createRecordForm
- getSeriesForView
- devDependencies
- getPasswordPolicyMessage
- StorageController
- AuthAccessPage
- pdf-polyfills.ts
- createClearanceForm
- AppServiceProvider.php
- vite.config.ts
- admin/reports.tsx
- student-year.ts
- TestCase
- scripts
- staff/reports.tsx
- createAssessmentForm
- auth-access.tsx
- logging.php
- sanctum.php
- peerDependenciesMeta
- console.php
- ExampleTest
- artisan
- pnpm
- peerDependencies
- getValidAccessToken
- ClinicKa
- admin-system-settings.ts
- backend/README.md
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
- `Props` --references--> `SubmissionRecord`  [EXTRACTED]
  src/app/components/medical-record-preview.tsx → src/app/lib/record-types.ts
- `ReportsDashboard()` --indirect_call--> `getReportingTermSettings()`  [INFERRED]
  src/app/components/reports/reports-dashboard.tsx → src/app/lib/api.ts
- `DialogOverlay` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/dialog.tsx → src/app/components/ui/utils.ts
- `prefetchPortalExperience()` --indirect_call--> `getStudentAnnouncements()`  [INFERRED]
  src/app/lib/login-prefetch.ts → src/app/lib/api.ts
- `prefetchRouteData()` --indirect_call--> `getStudentAnnouncements()`  [INFERRED]
  src/app/lib/login-prefetch.ts → src/app/lib/api.ts

## Import Cycles
- None detected.

## Communities (99 total, 18 thin omitted)

### Community 0 - "auth.tsx"
Cohesion: 0.06
Nodes (76): authenticateWithPassword(), authRequest(), AuthSession, clearStoredSession(), clearSupabaseAuthSession(), getCurrentAuthUser(), getSessionPolicy(), getStoredSession() (+68 more)

### Community 1 - "Announcement"
Cohesion: 0.19
Nodes (4): AnnouncementController, Response, Announcement, Illuminate\Support\Facades\Route

### Community 2 - "api.ts"
Cohesion: 0.04
Nodes (76): AcademicYearSetting, AdminCreateAccountInput, AdminCreateStaffInput, assertMedicalRecordDateInRange(), assertUploadFileSize(), AUTH_STORAGE_KEY, AuthChangeEvent, AuthStateChangeCallback (+68 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (72): dependencies, class-variance-authority, clsx, cmdk, date-fns, dotenv, embla-carousel-react, @emotion/react (+64 more)

### Community 4 - "route-modules.ts"
Cohesion: 0.07
Nodes (25): AppRole, loadAdminAnnouncements(), loadAdminLayout(), loadAdminSystemSettings(), loadAdminUserAccounts(), loadStaffCertificates(), loadStaffLayout(), loadStaffRecordReview() (+17 more)

### Community 5 - "dialog.tsx"
Cohesion: 0.20
Nodes (12): buildPdfPreviewUrl(), getDownloadFileName(), getFilePreviewType(), Props, SubmittedFilePreview, Dialog(), DialogClose, DialogContent (+4 more)

### Community 6 - "medical-record-pdf-export.tsx"
Cohesion: 0.05
Nodes (49): @react-pdf/renderer, buildBestRecordBySlot(), buildSlotPages(), CLEARANCE_SIGNATORY_NAMES, EXAM_FIELD_MAP, EXAM_ROWS, formatLocalPhone(), formatRadiologistNameWithDr() (+41 more)

### Community 7 - "package.json"
Cohesion: 0.03
Nodes (63): description, name, private, type, version, clsx, cmdk, date-fns (+55 more)

### Community 8 - "Illuminate\Http\Request"
Cohesion: 0.07
Nodes (13): AdminController, AuthController, NotificationController, SubmissionController, ArchivedAccount, Profile, StudentNotification, Illuminate\Foundation\Application (+5 more)

### Community 9 - "reports-dashboard.tsx"
Cohesion: 0.08
Nodes (22): DEPARTMENT_COLORS, DEPARTMENTS, formatLabStatus(), formatPhysicalExamStatus(), FunnelDatum, GENDER_COLORS, hasAbnormalUrinalysis(), hasAbnormalXray() (+14 more)

### Community 10 - "Illuminate\Database\Eloquent\Model"
Cohesion: 0.07
Nodes (14): App\Models\Notification, App\Models\NotificationState, Certificate, EmergencyContact, LabCbc, LabChestXray, LabUrinalysis, MedicalHistory (+6 more)

### Community 11 - "composer.json"
Cohesion: 0.04
Nodes (48): pestphp/pest-plugin, php-http/discovery, autoload, autoload-dev, psr-4, psr-4, config, allow-plugins (+40 more)

### Community 12 - "record-review.tsx"
Cohesion: 0.04
Nodes (41): CbcOcrExtraction, ChestXrayOcrExtraction, StaffSignatureAsset, UrinalysisOcrExtraction, STAFF_CLEARANCE_MUTATION_KEY, STAFF_REVIEW_MUTATION_KEY, AssessmentForm, AssessmentValidationErrors (+33 more)

### Community 13 - "medical-form.tsx"
Cohesion: 0.15
Nodes (35): formatAcademicYearLabel(), getDefaultAcademicYear(), getLatestRecordForAcademicYear(), getNextSubmissionSlot(), getRecordAcademicYear(), getSubmissionSlotLabel(), inferAcademicYearFromDate(), isCurrentAcademicYearBlocked() (+27 more)

### Community 14 - "use-student-medical-form.ts"
Cohesion: 0.07
Nodes (57): uploadFile(), LAB_UPLOAD_TYPES, LabUploadType, STUDENT_PROFILE_ASSET_UPLOAD_TYPES, StudentProfileAssetUploadType, MEDICAL_CONDITIONS, BmiCategory, EmergencyContact (+49 more)

### Community 15 - "submission-dashboard-cards.tsx"
Cohesion: 0.07
Nodes (46): ANALYTICS_VIEW_LABELS, AnalyticsDatum, AnalyticsSeries, AnalyticsView, buildAnalyticsData(), buildDonutData(), buildNoActionStudents(), buildStatusMetrics() (+38 more)

### Community 16 - "user-accounts.tsx"
Cohesion: 0.15
Nodes (24): class-variance-authority, @radix-ui/react-slot, MedicalClearancePreview, PasswordStrengthMeter(), PortalPageIntro(), Badge(), badgeVariants, DialogDescription (+16 more)

### Community 17 - "react"
Cohesion: 0.15
Nodes (13): react, InlinePdfViewer(), InlinePdfViewerProps, MedicalRecordPreview, Button, buttonVariants, Calendar(), CalendarProps (+5 more)

### Community 18 - "FileRecord"
Cohesion: 0.11
Nodes (7): OcrController, FileRecord, StorageService, Illuminate\Http\UploadedFile, Illuminate\Support\Facades\Http, Illuminate\Support\Facades\Log, Illuminate\Support\Facades\Storage

### Community 19 - "AuditLog"
Cohesion: 0.11
Nodes (10): CertificateController, ProfileController, Controller, AuditLog, StaffUser, Student, Illuminate\Support\Facades\Cache, Illuminate\Support\Facades\Hash (+2 more)

### Community 20 - "role-selection.tsx"
Cohesion: 0.16
Nodes (13): @radix-ui/react-accordion, Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), activeGridStyle, baseGridStyle, navLinks (+5 more)

### Community 21 - "apiRequest"
Cohesion: 0.10
Nodes (30): apiRequest(), ApiRequestError, archiveSuperAdminAdministrator(), archiveUserAccount(), changePasswordOnServer(), clearStudentNotifications(), deleteArchivedUserAccount(), deleteStudentNotification() (+22 more)

### Community 22 - "CryptoService"
Cohesion: 0.12
Nodes (13): DecryptPayloadMiddleware, Response, EncryptPayloadMiddleware, Response, Response, RoleMiddleware, SecurityHeadersMiddleware, CryptoService (+5 more)

### Community 23 - "record-types.ts"
Cohesion: 0.15
Nodes (12): ApprovedStudentRecordSummary, ApprovedStudentSummary, ClearanceInfo, DepartmentBreakdownItem, LabResults, MedicalHistory, PhysicalExamination, StaffDashboardOverview (+4 more)

### Community 24 - "check-email.tsx"
Cohesion: 0.67
Nodes (3): resendVerificationEmail(), CheckEmailPage(), loadCheckEmailPage()

### Community 25 - "profile.tsx"
Cohesion: 0.10
Nodes (38): AuthMe, invalidateStudentProfileAssetsCache(), updateStudentProfile(), uploadStudentProfileAsset(), buildProfileFormState(), normalizeProfileValue(), StaffSettings(), DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT (+30 more)

### Community 26 - "user-accounts-helpers.tsx"
Cohesion: 0.13
Nodes (22): AdminUserAccount, ArchivedUserAccount, AdminUserAccounts(), deriveStudentIdFromEmail(), CLINIC_STAFF_ROLE_FILTER, CsvAccountRow, DisplayableAccount, downloadAccountsCsv() (+14 more)

### Community 27 - "normalizeStorageFileUrl"
Cohesion: 0.14
Nodes (30): buildCloudinaryDeliveryUrl(), buildLabFileAssetFromRow(), buildStaffSignatureAssetFromRow(), buildStudentProfileAssetFromRow(), byId(), findGenericLabFile(), findLabFileByHint(), getAccessToken() (+22 more)

### Community 28 - "User"
Cohesion: 0.14
Nodes (13): User, UserFactory, DatabaseSeeder, Illuminate\Database\Console\Seeds\WithoutModelEvents, Illuminate\Database\Eloquent\Attributes\Fillable, Illuminate\Database\Eloquent\Attributes\Hidden, Illuminate\Database\Eloquent\Factories\Factory, Illuminate\Database\Eloquent\Factories\HasFactory (+5 more)

### Community 29 - "student-profile-form-card.tsx"
Cohesion: 0.19
Nodes (17): formatDateInputValue(), formatIsoToMdY(), formatReadOnlyDate(), formatReadOnlySex(), formatReadOnlyYearLevel(), getMaxBirthdateIso(), MONTH_OPTIONS, parseDateInputValue() (+9 more)

### Community 30 - "useAuth"
Cohesion: 0.17
Nodes (22): lucide-react, FilePickerButton(), FilePickerButtonProps, formatEmailName(), getInitials(), isRouteActive(), PortalNavItem, PortalShell() (+14 more)

### Community 31 - "StaffRecordReview"
Cohesion: 0.10
Nodes (34): extractCbcFields(), extractChestXrayFindings(), extractUrinalysisFields(), buildEmptyStaffSignature(), countVerifiedConditions(), getOcrStatusClass(), getStatusBadge(), isAllowedSignatureImage() (+26 more)

### Community 32 - "verify-ocr-parsers.cjs"
Cohesion: 0.11
Nodes (14): ref_node_assert, ref_node_fs, ref_node_module, ref_node_path, typescript, assert, fs, loadParserModule() (+6 more)

### Community 33 - "announcements-management.tsx"
Cohesion: 0.16
Nodes (15): AnnouncementUpsertInput, createAnnouncement(), deleteAnnouncement(), getManagedAnnouncements(), triggerCacheInvalidation(), updateAnnouncement(), AnnouncementsManagement(), ConfirmAction (+7 more)

### Community 34 - "password-policy.ts"
Cohesion: 0.19
Nodes (17): zxcvbn, createSuperAdminAdministrator(), buildUserTokens(), getEmailLocalPart(), getPasswordCharacterCount(), getPasswordStrengthResult(), getRegistrationPasswordMessage(), getStrengthSuggestions() (+9 more)

### Community 35 - "student-records-query.ts"
Cohesion: 0.29
Nodes (9): getMappedSubmissions(), getStudentRecords(), getSubmission(), getSubmissions(), shouldFallbackToRest(), invalidateStudentRecordsQuery(), normalizeStudentId(), studentRecordsQueryKey() (+1 more)

### Community 36 - "staff-workspace-preferences.ts"
Cohesion: 0.16
Nodes (17): AUTO_REFRESH_INTERVALS, CERTIFICATE_VIEWS, DASHBOARD_QUEUE_TABS, getDefaultStaffWorkspacePreferences(), getStorageKey(), isClinicDoctor(), loadStaffWorkspacePreferences(), normalizeStaffWorkspacePreferences() (+9 more)

### Community 37 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+9 more)

### Community 38 - "Submission"
Cohesion: 0.15
Nodes (5): Response, PostgrestCompatController, Submission, Illuminate\Database\Eloquent\Relations\HasMany, Illuminate\Database\Eloquent\Relations\HasOne

### Community 40 - "certificates.tsx"
Cohesion: 0.09
Nodes (41): react-router, getVisiblePages(), ListPagination(), ListPaginationProps, Input(), Select(), SelectContent(), SelectItem() (+33 more)

### Community 41 - "medical-clearance-preview.tsx"
Cohesion: 0.15
Nodes (10): CLEARANCE_SIGNATORY_NAMES, ClearanceCopy(), COPY_TYPES, formatCertificateIssuedDate(), matchClearanceSignatoryName(), MedicalClearancePreviewBase, normalizeSignatoryName(), Props (+2 more)

### Community 42 - "routes.tsx"
Cohesion: 0.07
Nodes (30): AdminAnnouncements, AdminDashboard, AdminLayout, AdminReports, AdminSystemSettings, AdminUserAccounts, CheckEmailPage, CreatePasswordPage (+22 more)

### Community 43 - "App.tsx"
Cohesion: 0.17
Nodes (12): next-themes, react-dom, ref_virtual_pwa_register, App(), Toaster(), ToasterProps, appQueryClient, router (+4 more)

### Community 44 - "system-settings.tsx"
Cohesion: 0.18
Nodes (18): sonner, PasswordChangeCard(), PasswordChangeCardProps, SettingsLogoutCard(), Card(), CardContent(), CardDescription(), CardFooter() (+10 more)

### Community 45 - "cn"
Cohesion: 0.07
Nodes (42): SettingsLogoutCardProps, formatNotificationTimestamp(), notificationDateFormatter, StudentNotificationMenu(), StudentNotificationMenuProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel() (+34 more)

### Community 46 - "use-swipe-navigation.ts"
Cohesion: 0.24
Nodes (13): BLOCK_ROUTES, createBackdrop(), createEdgeShadow(), createTabPreview(), findActiveIndex(), isBlockedRoute(), resolveTarget(), rubberBand() (+5 more)

### Community 47 - "SystemHealthCheckCommand.php"
Cohesion: 0.23
Nodes (7): MigrateSupabaseCommand, ServerBackupCommand, ServerRestoreCommand, SystemHealthCheckCommand, Illuminate\Console\Command, Illuminate\Support\Facades\DB, ZipArchive

### Community 48 - "SystemSetting"
Cohesion: 0.19
Nodes (3): SettingsController, OcrCallLog, SystemSetting

### Community 49 - "0001_01_01_000000_create_users_table.php"
Cohesion: 0.19
Nodes (3): Illuminate\Database\Migrations\Migration, Illuminate\Database\Schema\Blueprint, Illuminate\Support\Facades\Schema

### Community 50 - "getMe"
Cohesion: 0.11
Nodes (30): deriveNamePartsFromUser(), deriveStudentIdFromEmail(), getMe(), getMeCacheKey(), getStaffApprovedStudents(), isGCDomainEmail(), isGoogleAuthUser(), isMissingExaminedBySignatureUrlColumnError() (+22 more)

### Community 51 - "ReportsDashboard"
Cohesion: 0.22
Nodes (10): abbreviateCourse(), buildReportingTermRange(), formatCertificateStatus(), formatReportDate(), formatReportDateTime(), getFullName(), getSubmissionGroupValue(), normalizeCourseValue() (+2 more)

### Community 52 - "student/dashboard.tsx"
Cohesion: 0.11
Nodes (22): @tanstack/react-query, PortalPageIntroProps, PortalPageSkeleton(), PortalPageSkeletonVariant, PortalShellSkeleton(), PublicPageSkeleton(), PublicSkeletonVariant, getStudentAnnouncements() (+14 more)

### Community 53 - "updateAssessmentField"
Cohesion: 0.20
Nodes (12): getPhysicalExamFieldValidationError(), isPhysicalExamRequiredField(), isVisualAcuitySelectValue(), normalizeCountToX10Power9(), normalizeCountToX10Power9Whole(), sanitizeFractionLikeInput(), sanitizeNumericWithLimits(), sanitizeSafeText() (+4 more)

### Community 54 - "dom-pdf-export.ts"
Cohesion: 0.25
Nodes (9): html2canvas, jspdf, convertImageToDataUrl(), createPdfFromElement(), getCanvasScale(), getPdfPages(), PAGE_SIZES, PageSize (+1 more)

### Community 55 - "staff/dashboard.tsx"
Cohesion: 0.29
Nodes (12): getRoleLabel(), isDoctorPosition(), abbreviateCourse(), abbreviateDepartment(), formatDate(), formatEmailName(), formatSubmittedYearLevel(), getStatusLabel() (+4 more)

### Community 56 - "staff-workflow-query.ts"
Cohesion: 0.05
Nodes (84): recharts, getActiveAjaxRefetchInterval(), getAnalytics(), getArchivedUserAccounts(), getOcrAnalytics(), getStaffCertificateRecords(), getStaffDashboardOverview(), getStaffSubmissionSummaries() (+76 more)

### Community 57 - "excel-export.ts"
Cohesion: 0.40
Nodes (9): buildSheetRow(), buildXlsxBlob(), columnName(), concatBytes(), crc32(), createZipBlob(), escapeXml(), writeUint16() (+1 more)

### Community 58 - "password-strength-meter.tsx"
Cohesion: 0.25
Nodes (8): fillClasses, PasswordStrengthMeterProps, progressWidths, toneClasses, MIN_PASSWORD_LENGTH, PasswordPolicyUserInputs, PasswordSetupScreen(), PasswordSetupScreenProps

### Community 59 - "createRecordForm"
Cohesion: 0.29
Nodes (11): createEmptyMedicalHistory(), createRecordForm(), normalizeSexValue(), sanitizeAddress(), sanitizeContactNumber(), sanitizeEmergencyName(), sanitizeLettersOnly(), sanitizeMiddleInitial() (+3 more)

### Community 60 - "getSeriesForView"
Cohesion: 0.33
Nodes (6): formatGenderLabel(), getSeriesForView(), getSubmissionGroupLabel(), getSubmissionGroupValue(), normalizeGenderValue(), normalizeSeriesKey()

### Community 61 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+2 more)

### Community 62 - "getPasswordPolicyMessage"
Cohesion: 0.33
Nodes (7): createAdminAccount(), createAdminStaff(), getPasswordLengthMessage(), getPasswordPolicyMessage(), CreatePasswordPage(), handleSubmit(), getHomePath()

### Community 64 - "AuthAccessPage"
Cohesion: 0.46
Nodes (8): getPasswordResetCooldownRemaining(), getPasswordResetCooldownStorageKey(), sendPasswordResetEmail(), AuthAccessPage(), formatCooldown(), handleForgotPassword(), handlePasswordRecovery(), openForgotPasswordDialog()

### Community 66 - "createClearanceForm"
Cohesion: 0.28
Nodes (9): createClearanceForm(), isClearanceSignatoryName(), matchClearanceSignatoryName(), normalizeClearancePurposes(), normalizeClearanceSignatoryName(), normalizeSignatoryNameForMatch(), normalizeSingleClearancePurpose(), sanitizeLicenseNo() (+1 more)

### Community 67 - "AppServiceProvider.php"
Cohesion: 0.29
Nodes (4): AppServiceProvider, Illuminate\Cache\RateLimiting\Limit, Illuminate\Support\Facades\RateLimiter, Illuminate\Support\ServiceProvider

### Community 68 - "vite.config.ts"
Cohesion: 0.29
Nodes (6): dotenv, ref_path, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 70 - "student-year.ts"
Cohesion: 0.39
Nodes (8): getOrdinalSuffix(), getYearLevelLabel(), inferStudentYearLevel(), isCurrentSubmissionYear(), MAX_ACADEMIC_YEAR_LEVEL, normalizeYearLevel(), resolveStudentYearLevel(), StudentYearSource

### Community 71 - "TestCase"
Cohesion: 0.47
Nodes (3): ExampleTest, TestCase, Illuminate\Foundation\Testing\TestCase

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, typecheck, verify:ocr

### Community 74 - "createAssessmentForm"
Cohesion: 0.20
Nodes (10): calculateBmi(), createAssessmentForm(), formatDateInputValue(), getMedicalRecordDateBounds(), getMedicalRecordDateValidationMessage(), getTodayDateInputValue(), normalizeVisualAcuitySelectValue(), sanitizeVisualAcuityText() (+2 more)

### Community 75 - "auth-access.tsx"
Cohesion: 0.23
Nodes (10): @radix-ui/react-dialog, PASSWORD_RESET_COOLDOWN_SECONDS, UserRole, CONTACT_EMAIL, LegalSection, POLICY_UPDATED_AT, privacySections, termsSections (+2 more)

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

### Community 83 - "pnpm"
Cohesion: 0.67
Nodes (3): vite, pnpm, overrides

### Community 84 - "peerDependencies"
Cohesion: 0.67
Nodes (3): peerDependencies, react, react-dom

### Community 85 - "getValidAccessToken"
Cohesion: 0.20
Nodes (14): getNowUnixSeconds(), getValidAccessToken(), isSessionExpiringSoon(), normalizeSessionTimestamps(), parseUnixSeconds(), restCount(), uploadToHardenedStorage(), base64ToBytes() (+6 more)

### Community 97 - "ClinicKa"
Cohesion: 0.13
Nodes (14): 1. Database Setup, 2. Backend Setup (Laravel), 3. Frontend Setup (React / Vite), ClinicKa, Core Technologies, Directory Structure, Disclaimer, Environment Configuration (+6 more)

### Community 100 - "admin-system-settings.ts"
Cohesion: 0.19
Nodes (19): ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS, ADMIN_SYSTEM_SETTINGS_OCR_PROVIDERS, ADMIN_SYSTEM_SETTINGS_SEMESTERS, AdminSystemSettings, createDefaultAdminSystemSettings(), getDefaultAcademicYear(), isMissingKvStoreError(), isMissingRouteError() (+11 more)

### Community 101 - "backend/README.md"
Cohesion: 0.25
Nodes (7): About Laravel, Agentic Development, Code of Conduct, Contributing, Learning Laravel, License, Security Vulnerabilities

## Knowledge Gaps
- **490 isolated node(s):** `$schema`, `name`, `type`, `description`, `keywords` (+485 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 670 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `auth.tsx`, `dialog.tsx`, `medical-record-pdf-export.tsx`, `package.json`, `reports-dashboard.tsx`, `record-review.tsx`, `medical-form.tsx`, `use-student-medical-form.ts`, `submission-dashboard-cards.tsx`, `user-accounts.tsx`, `role-selection.tsx`, `apiRequest`, `check-email.tsx`, `profile.tsx`, `user-accounts-helpers.tsx`, `student-profile-form-card.tsx`, `useAuth`, `announcements-management.tsx`, `certificates.tsx`, `medical-clearance-preview.tsx`, `routes.tsx`, `App.tsx`, `system-settings.tsx`, `cn`, `use-swipe-navigation.ts`, `student/dashboard.tsx`, `staff/dashboard.tsx`, `staff-workflow-query.ts`, `password-strength-meter.tsx`, `auth-access.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `useAuth` to `dialog.tsx`, `package.json`, `reports-dashboard.tsx`, `record-review.tsx`, `medical-form.tsx`, `submission-dashboard-cards.tsx`, `user-accounts.tsx`, `react`, `role-selection.tsx`, `check-email.tsx`, `profile.tsx`, `student-profile-form-card.tsx`, `certificates.tsx`, `system-settings.tsx`, `cn`, `student/dashboard.tsx`, `staff/dashboard.tsx`, `staff-workflow-query.ts`, `password-strength-meter.tsx`, `auth-access.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `type` to the rest of the system?**
  _490 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `auth.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06491398896462187 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03518518518518519 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.027777777777777776 - nodes in this community are weakly interconnected._