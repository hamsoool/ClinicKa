# Graph Report - ClinicKa  (2026-09-21)

## Corpus Check
- 215 files · ~482,948 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 38 file(s) not represented in the graph (top: (none) 26, .css 5, .example 2)

## Summary
- 2162 nodes · 5882 edges · 110 communities (88 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `194ba72a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.tsx
- Student
- api.ts
- dependencies
- check-email.tsx
- Illuminate\Support\Str
- medical-record-pdf-export.tsx
- package.json
- Profile
- reports-dashboard.tsx
- Illuminate\Database\Eloquent\Model
- composer.json
- record-review.tsx
- pdf-polyfills.ts
- use-student-medical-form.ts
- submission-dashboard-cards.tsx
- cn
- route-modules.ts
- FileRecord
- AuditService
- AuditLog
- apiRequest
- CryptoService
- clearance.tsx
- login-prefetch.ts
- profile.tsx
- user-accounts-helpers.tsx
- normalizeStorageFileUrl
- admin/dashboard.tsx
- student-profile-form-card.tsx
- useAuth
- StaffRecordReview
- verify-ocr-parsers.cjs
- announcements-management.tsx
- OcrService
- staff-workflow-query.ts
- staff-workspace-preferences.ts
- compilerOptions
- Submission
- admin-system-settings.ts
- submissions.tsx
- medical-clearance-preview.tsx
- routes.tsx
- App.tsx
- system-settings.tsx
- student-records-query.ts
- use-swipe-navigation.ts
- normalizeDateInputValue
- Illuminate\Http\Request
- Illuminate\Support\Facades\Schema
- getMe
- student-year.ts
- admin-workflow-query.ts
- updateAssessmentField
- dom-pdf-export.ts
- record-types.ts
- ReportsDashboard
- excel-export.ts
- getSeriesForView
- createRecordForm
- constants.ts
- devDependencies
- staff/dashboard.tsx
- bootstrap/app.php
- getPasswordPolicyMessage
- buildAcademicYearSetting
- sanitizeSafeText
- AppServiceProvider.php
- vite.config.ts
- Announcement
- formatPhilippinePhoneInput
- badge.tsx
- scripts
- student-notification-save-queue.ts
- createAssessmentForm
- auth-access.tsx
- logging.php
- sanctum.php
- peerDependenciesMeta
- console.php
- ExampleTest
- certificates.tsx
- artisan
- pnpm
- peerDependencies
- student-profile-assets-query.ts
- ClinicKa
- AuditLogPage
- admin/announcements.tsx
- uploadToHardenedStorage
- backend/README.md
- button.tsx
- CLAUDE.md
- upload-activity.ts
- react-dom-client.d.ts
- admin/reports.tsx
- staff/announcements.tsx
- staff/reports.tsx
- lucide-react

## God Nodes (most connected - your core abstractions)
1. `cn()` - 108 edges
2. `react` - 73 edges
3. `StaffRecordReview()` - 71 edges
4. `Profile` - 57 edges
5. `useAuth()` - 51 edges
6. `useStudentMedicalForm()` - 51 edges
7. `AuditLog` - 49 edges
8. `lucide-react` - 49 edges
9. `apiRequest()` - 44 edges
10. `AuthProvider()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Privacy` --references--> `AuditService`  [INFERRED]
  docs/audit-logging.md → backend/app/Services/AuditService.php
- `Adding an event` --references--> `AuditService`  [INFERRED]
  docs/audit-logging.md → backend/app/Services/AuditService.php
- `ReportsDashboard()` --indirect_call--> `getReportingTermSettings()`  [INFERRED]
  src/app/components/reports/reports-dashboard.tsx → src/app/lib/api.ts
- `AlertDialogOverlay` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/alert-dialog.tsx → src/app/components/ui/utils.ts
- `DropdownMenuCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/dropdown-menu.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (110 total, 22 thin omitted)

### Community 0 - "auth.tsx"
Cohesion: 0.08
Nodes (62): authenticateWithPassword(), AuthSession, clearStoredSession(), clearSupabaseAuthSession(), getCurrentAuthUser(), getSessionPolicy(), getStoredSession(), getSupabaseAuthSession() (+54 more)

### Community 1 - "Student"
Cohesion: 0.14
Nodes (6): ProfileController, Response, StorageController, StaffUser, Student, Illuminate\Database\Eloquent\Factories\HasFactory

### Community 2 - "api.ts"
Cohesion: 0.03
Nodes (84): AcademicYearSetting, AdminCreateAccountInput, AdminCreateStaffInput, assertMedicalRecordDateInRange(), assertUploadFileSize(), AuditLog, AuditLogFilters, AuditLogPage (+76 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (72): dependencies, class-variance-authority, clsx, cmdk, date-fns, dotenv, embla-carousel-react, @emotion/react (+64 more)

### Community 4 - "check-email.tsx"
Cohesion: 0.67
Nodes (3): resendVerificationEmail(), CheckEmailPage(), loadCheckEmailPage()

### Community 5 - "Illuminate\Support\Str"
Cohesion: 0.10
Nodes (9): OcrCallLog, UserFactory, Illuminate\Database\Eloquent\Factories\Factory, Illuminate\Support\Facades\Hash, Illuminate\Support\Facades\Http, Illuminate\Support\Facades\Log, Illuminate\Support\Str, Pdo\Mysql (+1 more)

### Community 6 - "medical-record-pdf-export.tsx"
Cohesion: 0.06
Nodes (48): @react-pdf/renderer, buildBestRecordBySlot(), buildSlotPages(), CLEARANCE_SIGNATORY_NAMES, EXAM_FIELD_MAP, EXAM_ROWS, formatLocalPhone(), formatRadiologistNameWithDr() (+40 more)

### Community 7 - "package.json"
Cohesion: 0.03
Nodes (61): description, name, private, type, version, clsx, cmdk, date-fns (+53 more)

### Community 8 - "Profile"
Cohesion: 0.07
Nodes (17): Profile, User, DatabaseSeeder, AuditLogAuthorizationTest, ExampleTest, TestCase, AuditServiceTest, Illuminate\Database\Console\Seeds\WithoutModelEvents (+9 more)

### Community 9 - "reports-dashboard.tsx"
Cohesion: 0.08
Nodes (22): DEPARTMENT_COLORS, DEPARTMENTS, formatLabStatus(), formatPhysicalExamStatus(), FunnelDatum, GENDER_COLORS, hasAbnormalUrinalysis(), hasAbnormalXray() (+14 more)

### Community 10 - "Illuminate\Database\Eloquent\Model"
Cohesion: 0.07
Nodes (19): App\Models\Notification, App\Models\NotificationState, MigrateSupabaseCommand, PruneAuditLogsCommand, ServerBackupCommand, ServerRestoreCommand, Certificate, EmergencyContact (+11 more)

### Community 11 - "composer.json"
Cohesion: 0.04
Nodes (48): pestphp/pest-plugin, php-http/discovery, autoload, autoload-dev, psr-4, psr-4, config, allow-plugins (+40 more)

### Community 12 - "record-review.tsx"
Cohesion: 0.04
Nodes (39): CbcOcrExtraction, ChestXrayOcrExtraction, StaffSignatureAsset, UrinalysisOcrExtraction, AssessmentForm, AssessmentValidationErrors, BLOOD_TYPE_OPTIONS, CbcOcrState (+31 more)

### Community 14 - "use-student-medical-form.ts"
Cohesion: 0.10
Nodes (46): uploadFile(), src_app_pages_student_medical_form_types_labuploadkind, addressesMatch(), buildInitialFormData(), buildOperationDetails(), calculateAgeFromBirthdate(), calculateBmi(), CLINIC_INTERNAL_LAB_SOURCE_ALIASES (+38 more)

### Community 15 - "submission-dashboard-cards.tsx"
Cohesion: 0.08
Nodes (45): ANALYTICS_VIEW_LABELS, AnalyticsDatum, AnalyticsSeries, AnalyticsView, buildAnalyticsData(), buildDonutData(), buildNoActionStudents(), buildStatusMetrics() (+37 more)

### Community 16 - "cn"
Cohesion: 0.11
Nodes (48): react, actionOptions, AuditLogPageProps, categoryOptions, dateTimeFormatter, roleOptions, PasswordChangeCard(), PasswordChangeCardProps (+40 more)

### Community 17 - "route-modules.ts"
Cohesion: 0.08
Nodes (25): AppRole, loadAdminLayout(), loadAdminSystemSettings(), loadAdminUserAccounts(), loadStaffCertificates(), loadStaffLayout(), loadStaffRecordReview(), loadStaffSettings() (+17 more)

### Community 18 - "FileRecord"
Cohesion: 0.11
Nodes (6): SystemHealthCheckCommand, OcrController, FileRecord, StorageService, Illuminate\Http\UploadedFile, Illuminate\Support\Facades\Storage

### Community 20 - "AuditLog"
Cohesion: 0.15
Nodes (3): AdminController, ArchivedAccount, AuditLog

### Community 21 - "apiRequest"
Cohesion: 0.10
Nodes (29): apiRequest(), ApiRequestError, archiveSuperAdminAdministrator(), changePasswordOnServer(), clearStudentNotifications(), createSuperAdminAdministrator(), deleteArchivedUserAccount(), deleteStudentNotification() (+21 more)

### Community 22 - "CryptoService"
Cohesion: 0.12
Nodes (13): DecryptPayloadMiddleware, Response, EncryptPayloadMiddleware, Response, Response, RoleMiddleware, SecurityHeadersMiddleware, CryptoService (+5 more)

### Community 23 - "clearance.tsx"
Cohesion: 0.15
Nodes (38): MedicalClearancePreview, PortalPageSkeleton(), formatAcademicYearLabel(), getDefaultAcademicYear(), getLatestRecordForAcademicYear(), getNextSubmissionSlot(), getRecordAcademicYear(), getSubmissionSlotLabel() (+30 more)

### Community 24 - "login-prefetch.ts"
Cohesion: 0.24
Nodes (16): AuthMe, getSuperAdminAdministrators(), inferRoleFromEmail(), normalizeEmail(), prefetchLikelyPortalRoutes(), prefetchPortalExperience(), prefetchRouteData(), warmQuery() (+8 more)

### Community 25 - "profile.tsx"
Cohesion: 0.21
Nodes (20): updateStudentProfile(), uploadStudentProfileAsset(), getProgramOptionsForSelect(), getProgramsForDepartment(), normalizeProgramForDepartment(), resolveDepartmentValue(), buildEmptyAssets(), buildProfileFormState() (+12 more)

### Community 26 - "user-accounts-helpers.tsx"
Cohesion: 0.12
Nodes (24): AdminUserAccount, ArchivedUserAccount, archiveUserAccount(), restoreArchivedUserAccount(), AdminUserAccounts(), deriveStudentIdFromEmail(), CLINIC_STAFF_ROLE_FILTER, CsvAccountRow (+16 more)

### Community 27 - "normalizeStorageFileUrl"
Cohesion: 0.13
Nodes (31): buildCloudinaryDeliveryUrl(), buildLabFileAssetFromRow(), buildStaffSignatureAssetFromRow(), buildStudentProfileAssetFromRow(), byId(), findGenericLabFile(), findLabFileByHint(), getAccessToken() (+23 more)

### Community 28 - "admin/dashboard.tsx"
Cohesion: 0.18
Nodes (15): recharts, useAdminAnalyticsQuery(), useAdminSubmissionsQuery(), AdminDashboard(), dateFormatter, dateTimeFormatter, formatDate(), formatDateTime() (+7 more)

### Community 29 - "student-profile-form-card.tsx"
Cohesion: 0.13
Nodes (22): @radix-ui/react-popover, formatDateInputValue(), formatIsoToMdY(), formatReadOnlyDate(), formatReadOnlySex(), formatReadOnlyYearLevel(), getMaxBirthdateIso(), MONTH_OPTIONS (+14 more)

### Community 30 - "useAuth"
Cohesion: 0.23
Nodes (16): formatEmailName(), getInitials(), PortalNavItem, PortalShell(), PortalTopAction, useAuth(), AdminLayout(), navItems (+8 more)

### Community 31 - "StaffRecordReview"
Cohesion: 0.13
Nodes (18): getClearanceSignatories(), buildEmptyStaffSignature(), countVerifiedConditions(), getOcrStatusClass(), getStatusBadge(), isAllowedSignatureImage(), isClearancePurpose(), isClinicManagedLabSource() (+10 more)

### Community 32 - "verify-ocr-parsers.cjs"
Cohesion: 0.11
Nodes (14): ref_node_assert, ref_node_fs, ref_node_module, ref_node_path, typescript, assert, fs, loadParserModule() (+6 more)

### Community 33 - "announcements-management.tsx"
Cohesion: 0.18
Nodes (15): AnnouncementUpsertInput, createAnnouncement(), deleteAnnouncement(), getManagedAnnouncements(), triggerCacheInvalidation(), updateAnnouncement(), uploadAnnouncementImage(), AnnouncementsManagement() (+7 more)

### Community 35 - "staff-workflow-query.ts"
Cohesion: 0.11
Nodes (33): getActiveAjaxRefetchInterval(), getAnalytics(), getStaffApprovedStudents(), getStaffCertificateRecords(), getStaffDashboardOverview(), getStaffSubmissionSummaries(), StaffApprovedStudentFilters, StaffSubmissionSummaryFilters (+25 more)

### Community 36 - "staff-workspace-preferences.ts"
Cohesion: 0.16
Nodes (17): AUTO_REFRESH_INTERVALS, CERTIFICATE_VIEWS, DASHBOARD_QUEUE_TABS, getDefaultStaffWorkspacePreferences(), getStorageKey(), isClinicDoctor(), loadStaffWorkspacePreferences(), normalizeStaffWorkspacePreferences() (+9 more)

### Community 37 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+9 more)

### Community 38 - "Submission"
Cohesion: 0.14
Nodes (5): Response, PostgrestCompatController, Submission, Illuminate\Database\Eloquent\Relations\HasMany, Illuminate\Database\Eloquent\Relations\HasOne

### Community 39 - "admin-system-settings.ts"
Cohesion: 0.24
Nodes (15): ADMIN_SYSTEM_SETTINGS_ARCHIVE_OPTIONS, ADMIN_SYSTEM_SETTINGS_OCR_PROVIDERS, ADMIN_SYSTEM_SETTINGS_SEMESTERS, AdminSystemSettings, createDefaultAdminSystemSettings(), getDefaultAcademicYear(), isMissingKvStoreError(), isMissingRouteError() (+7 more)

### Community 40 - "submissions.tsx"
Cohesion: 0.10
Nodes (29): @tanstack/react-query, getVisiblePages(), ListPagination(), ListPaginationProps, Select(), SelectContent(), SelectItem(), SelectLabel() (+21 more)

### Community 41 - "medical-clearance-preview.tsx"
Cohesion: 0.14
Nodes (11): CLEARANCE_SIGNATORY_NAMES, ClearanceCopy(), COPY_TYPES, formatCertificateIssuedDate(), matchClearanceSignatoryName(), MedicalClearancePreviewBase, normalizeSignatoryName(), Props (+3 more)

### Community 42 - "routes.tsx"
Cohesion: 0.06
Nodes (33): AdminAnnouncements, AdminAuditLogs, AdminDashboard, AdminLayout, AdminReports, AdminSystemSettings, AdminUserAccounts, CheckEmailPage (+25 more)

### Community 43 - "App.tsx"
Cohesion: 0.17
Nodes (12): next-themes, react-dom, ref_virtual_pwa_register, App(), Toaster(), ToasterProps, appQueryClient, router (+4 more)

### Community 44 - "system-settings.tsx"
Cohesion: 0.08
Nodes (37): @radix-ui/react-dropdown-menu, react-router, sonner, isRouteActive(), PortalShellProps, SettingsLogoutCard(), SettingsLogoutCardProps, formatNotificationTimestamp() (+29 more)

### Community 45 - "student-records-query.ts"
Cohesion: 0.27
Nodes (12): getMappedSubmissions(), getStudentRecords(), getStudentRecordSummaries(), getSubmission(), getSubmissions(), mapStudentRecordSummary(), shouldFallbackToRest(), invalidateStudentRecordsQuery() (+4 more)

### Community 46 - "use-swipe-navigation.ts"
Cohesion: 0.24
Nodes (13): BLOCK_ROUTES, createBackdrop(), createEdgeShadow(), createTabPreview(), findActiveIndex(), isBlockedRoute(), resolveTarget(), rubberBand() (+5 more)

### Community 47 - "normalizeDateInputValue"
Cohesion: 0.19
Nodes (16): extractCbcFields(), extractChestXrayFindings(), extractUrinalysisFields(), isMedicalRecordDateInRange(), normalizeDateInputValue(), commitAssessmentFormChange(), getCbcDetectedFieldCount(), getUploadedLabOcrTypes() (+8 more)

### Community 48 - "Illuminate\Http\Request"
Cohesion: 0.08
Nodes (16): AuditLogController, AuthController, CertificateController, NotificationController, SettingsController, SubmissionController, Controller, StudentNotification (+8 more)

### Community 49 - "Illuminate\Support\Facades\Schema"
Cohesion: 0.14
Nodes (3): Illuminate\Database\Migrations\Migration, Illuminate\Database\Schema\Blueprint, Illuminate\Support\Facades\Schema

### Community 50 - "getMe"
Cohesion: 0.13
Nodes (26): deriveNamePartsFromUser(), deriveStudentIdFromEmail(), getMe(), getMeCacheKey(), invalidateMeCache(), isGCDomainEmail(), isGoogleAuthUser(), isMissingExaminedBySignatureUrlColumnError() (+18 more)

### Community 51 - "student-year.ts"
Cohesion: 0.23
Nodes (12): deriveSubmissionLabSourceMetadata(), isClinicManagedLabSource(), resolveActiveAcademicYear(), submitMedicalRecord(), updateMedicalRecord(), getOrdinalSuffix(), inferStudentYearLevel(), isCurrentSubmissionYear() (+4 more)

### Community 52 - "admin-workflow-query.ts"
Cohesion: 0.13
Nodes (27): getArchivedUserAccounts(), getOcrAnalytics(), getStaffUsers(), getUserAccounts(), sendSettingsChangeOtp(), adminAnalyticsQueryKey(), adminArchivedAccountsQueryKey(), adminArchivedAccountsQueryOptions() (+19 more)

### Community 53 - "updateAssessmentField"
Cohesion: 0.20
Nodes (11): isPhysicalExamRequiredField(), isVisualAcuitySelectValue(), normalizeCountToX10Power9(), normalizeCountToX10Power9Whole(), sanitizeFractionLikeInput(), sanitizeNumericWithLimits(), handleVisualAcuityChange(), normalizeCbcOcrFields() (+3 more)

### Community 54 - "dom-pdf-export.ts"
Cohesion: 0.21
Nodes (11): html2canvas, jspdf, InlinePdfViewerProps, convertImageToDataUrl(), createPdfFromElement(), DomPdfPageFormat, getCanvasScale(), getPdfPages() (+3 more)

### Community 55 - "record-types.ts"
Cohesion: 0.15
Nodes (12): ApprovedStudentRecordSummary, ApprovedStudentSummary, ClearanceInfo, DepartmentBreakdownItem, LabResults, MedicalHistory, PhysicalExamination, StaffDashboardOverview (+4 more)

### Community 56 - "ReportsDashboard"
Cohesion: 0.22
Nodes (10): abbreviateCourse(), buildReportingTermRange(), formatCertificateStatus(), formatReportDate(), formatReportDateTime(), getFullName(), getSubmissionGroupValue(), normalizeCourseValue() (+2 more)

### Community 57 - "excel-export.ts"
Cohesion: 0.40
Nodes (9): buildSheetRow(), buildXlsxBlob(), columnName(), concatBytes(), crc32(), createZipBlob(), escapeXml(), writeUint16() (+1 more)

### Community 58 - "getSeriesForView"
Cohesion: 0.33
Nodes (6): formatGenderLabel(), getSeriesForView(), getSubmissionGroupLabel(), getSubmissionGroupValue(), normalizeGenderValue(), normalizeSeriesKey()

### Community 59 - "createRecordForm"
Cohesion: 0.29
Nodes (11): createEmptyMedicalHistory(), createRecordForm(), normalizeSexValue(), sanitizeAddress(), sanitizeContactNumber(), sanitizeEmergencyName(), sanitizeLettersOnly(), sanitizeMiddleInitial() (+3 more)

### Community 60 - "constants.ts"
Cohesion: 0.10
Nodes (20): LAB_UPLOAD_TYPES, LabUploadType, STUDENT_PROFILE_ASSET_UPLOAD_TYPES, StudentProfileAssetUploadType, DATA_PRIVACY_CONSENT_ACKNOWLEDGEMENT, DATA_PRIVACY_CONSENT_BODY, DATA_PRIVACY_RIGHTS_NOTICE, DEFAULT_MEDICAL_HISTORY (+12 more)

### Community 61 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+2 more)

### Community 62 - "staff/dashboard.tsx"
Cohesion: 0.29
Nodes (13): getRoleLabel(), isDoctorPosition(), getYearLevelLabel(), abbreviateCourse(), abbreviateDepartment(), formatDate(), formatEmailName(), formatSubmittedYearLevel() (+5 more)

### Community 63 - "bootstrap/app.php"
Cohesion: 0.40
Nodes (3): Illuminate\Foundation\Application, Illuminate\Foundation\Configuration\Exceptions, Illuminate\Foundation\Configuration\Middleware

### Community 64 - "getPasswordPolicyMessage"
Cohesion: 0.15
Nodes (21): authRequest(), createAdminAccount(), createAdminStaff(), getNowUnixSeconds(), getPasswordResetCooldownRemaining(), getPasswordResetCooldownStorageKey(), getValidAccessToken(), isSessionExpiringSoon() (+13 more)

### Community 65 - "buildAcademicYearSetting"
Cohesion: 0.47
Nodes (6): buildAcademicYearSetting(), formatAcademicYearSettingValue(), getAcademicYearSetting(), getActiveAcademicYearSettings(), isMissingSystemSettingsError(), updateAcademicYearSetting()

### Community 66 - "sanitizeSafeText"
Cohesion: 0.18
Nodes (15): addClearanceSignatory(), createClearanceForm(), getPhysicalExamFieldValidationError(), isClearanceSignatoryName(), matchClearanceSignatoryName(), normalizeClearancePurposes(), normalizeClearanceSignatoryName(), normalizeSignatoryNameForMatch() (+7 more)

### Community 67 - "AppServiceProvider.php"
Cohesion: 0.29
Nodes (4): AppServiceProvider, Illuminate\Cache\RateLimiting\Limit, Illuminate\Support\Facades\RateLimiter, Illuminate\Support\ServiceProvider

### Community 68 - "vite.config.ts"
Cohesion: 0.29
Nodes (6): dotenv, ref_path, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 69 - "Announcement"
Cohesion: 0.23
Nodes (3): AnnouncementController, Response, Announcement

### Community 70 - "formatPhilippinePhoneInput"
Cohesion: 0.60
Nodes (5): buildProfileFormState(), normalizeProfileValue(), StaffSettings(), formatPhilippinePhoneInput(), isValidPhilippinePhoneNumber()

### Community 71 - "badge.tsx"
Cohesion: 0.31
Nodes (8): actionLabel(), dateTimeFormatter, formatDate(), RecordActivity(), RecordActivityProps, Badge(), badgeVariants, getStudentAuditHistory()

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, typecheck, verify:ocr

### Community 73 - "student-notification-save-queue.ts"
Cohesion: 0.60
Nodes (4): flushPendingStudentNotificationSaves(), normalizeStudentId(), pendingStudentNotificationSaves, trackPendingStudentNotificationSave()

### Community 74 - "createAssessmentForm"
Cohesion: 0.20
Nodes (10): calculateBmi(), createAssessmentForm(), formatDateInputValue(), getMedicalRecordDateBounds(), getMedicalRecordDateValidationMessage(), getTodayDateInputValue(), normalizeVisualAcuitySelectValue(), sanitizeVisualAcuityText() (+2 more)

### Community 75 - "auth-access.tsx"
Cohesion: 0.05
Nodes (52): @radix-ui/react-accordion, @radix-ui/react-dialog, zxcvbn, fillClasses, PasswordStrengthMeterProps, progressWidths, toneClasses, Accordion() (+44 more)

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

### Community 81 - "certificates.tsx"
Cohesion: 0.11
Nodes (19): PortalPageSkeletonVariant, PortalShellSkeleton(), PublicPageSkeleton(), PublicSkeletonVariant, Skeleton(), clearRememberedCertificateStudent(), DEPARTMENTS, formatMedicalCertificateFileName() (+11 more)

### Community 83 - "pnpm"
Cohesion: 0.67
Nodes (3): vite, pnpm, overrides

### Community 84 - "peerDependencies"
Cohesion: 0.67
Nodes (3): peerDependencies, react, react-dom

### Community 86 - "student-profile-assets-query.ts"
Cohesion: 0.48
Nodes (6): StudentProfileAssets, EMPTY_STUDENT_PROFILE_ASSETS, normalizeId(), studentProfileAssetsQueryKey(), studentProfileAssetsQueryOptions(), useStudentProfileAssetsQuery()

### Community 97 - "ClinicKa"
Cohesion: 0.10
Nodes (19): Append-only behavior, Audit Logging, Audited events, Privacy, Visibility, 1. Database Setup, 2. Backend Setup (Laravel), 3. Frontend Setup (React / Vite) (+11 more)

### Community 98 - "AuditLogPage"
Cohesion: 0.20
Nodes (6): AuditLogPage(), formatDate(), label(), resultClassName(), loadAdminAuditLogs(), loadSuperAdminAuditLogs()

### Community 100 - "uploadToHardenedStorage"
Cohesion: 0.39
Nodes (8): uploadToHardenedStorage(), base64ToBytes(), bytesToBase64(), decryptPayload(), EncryptedEnvelope, encryptPayload(), getCryptoKey(), isEncryptedEnvelope()

### Community 101 - "backend/README.md"
Cohesion: 0.25
Nodes (7): About Laravel, Agentic Development, Code of Conduct, Contributing, Learning Laravel, License, Security Vulnerabilities

### Community 102 - "button.tsx"
Cohesion: 0.13
Nodes (14): class-variance-authority, @radix-ui/react-slot, InlinePdfViewer(), MedicalRecordPreview, buildPdfPreviewUrl(), getDownloadFileName(), getFilePreviewType(), Props (+6 more)

### Community 104 - "upload-activity.ts"
Cohesion: 0.33
Nodes (6): beginTrackedUpload(), emitUploadActivityChange(), getActiveUploadCount(), listeners, subscribeToUploadActivity(), UploadActivityListener

### Community 110 - "lucide-react"
Cohesion: 0.23
Nodes (9): lucide-react, FilePickerButton(), FilePickerButtonProps, Checkbox(), RadioGroup(), RadioGroupItem(), YEAR_LEVELS, MedicalFormStepContent (+1 more)

## Knowledge Gaps
- **504 isolated node(s):** `$schema`, `name`, `type`, `description`, `keywords` (+499 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 690 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `cn` to `auth.tsx`, `check-email.tsx`, `medical-record-pdf-export.tsx`, `package.json`, `reports-dashboard.tsx`, `record-review.tsx`, `use-student-medical-form.ts`, `submission-dashboard-cards.tsx`, `apiRequest`, `clearance.tsx`, `profile.tsx`, `user-accounts-helpers.tsx`, `admin/dashboard.tsx`, `student-profile-form-card.tsx`, `useAuth`, `announcements-management.tsx`, `submissions.tsx`, `medical-clearance-preview.tsx`, `routes.tsx`, `App.tsx`, `system-settings.tsx`, `use-swipe-navigation.ts`, `staff/dashboard.tsx`, `badge.tsx`, `auth-access.tsx`, `certificates.tsx`, `button.tsx`, `react-dom-client.d.ts`, `lucide-react`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `check-email.tsx`, `button.tsx`, `package.json`, `submissions.tsx`, `badge.tsx`, `reports-dashboard.tsx`, `auth-access.tsx`, `system-settings.tsx`, `record-review.tsx`, `submission-dashboard-cards.tsx`, `cn`, `certificates.tsx`, `clearance.tsx`, `staff/dashboard.tsx`, `profile.tsx`, `admin/dashboard.tsx`, `student-profile-form-card.tsx`, `useAuth`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `type` to the rest of the system?**
  _504 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `auth.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Student` be split into smaller, more focused modules?**
  _Cohesion score 0.13768115942028986 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.033176593521421105 - nodes in this community are weakly interconnected._