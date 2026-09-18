-- =============================================================================
-- ClinicKa Database Schema for MariaDB (10.11+ LTS) / MySQL (8.0+)
-- Stage 1.2: Comprehensive Migration Schema
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -----------------------------------------------------------------------------
-- 1. System Settings
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `key` VARCHAR(191) NOT NULL,
  `value` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`key`, `value`) VALUES
('current_academic_year', 'SY 2025-2026'),
('ocr_provider', 'ocr-space'),
('session_timeout_minutes', '60')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- -----------------------------------------------------------------------------
-- 2. User Profiles (Core Identity)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `role` ENUM('student', 'staff', 'admin', 'super_admin') NOT NULL DEFAULT 'student',
  `first_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NULL,
  `student_id` VARCHAR(50) NULL,
  `department` VARCHAR(50) NULL,
  `course` VARCHAR(100) NULL,
  `password_setup_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `is_banned` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `profiles_email_unique` (`email`),
  KEY `profiles_student_id_idx` (`student_id`),
  KEY `profiles_role_idx` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Students (Demographics & Permanent Asset Links)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `student_id` VARCHAR(50) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `middle_initial` VARCHAR(10) NULL,
  `department` VARCHAR(50) NOT NULL,
  `course` VARCHAR(100) NOT NULL,
  `year_level` INT NOT NULL DEFAULT 1,
  `age` INT NULL,
  `sex` VARCHAR(20) NULL,
  `birthday` DATE NULL,
  `civil_status` VARCHAR(50) NULL,
  `contact_number` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `profile_photo_url` TEXT NULL,
  `profile_photo_file_name` VARCHAR(255) NULL,
  `signature_url` TEXT NULL,
  `signature_file_name` VARCHAR(255) NULL,
  `media_updated_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  KEY `students_profile_id_idx` (`profile_id`),
  KEY `students_student_profile_idx` (`student_id`, `profile_id`),
  KEY `students_dept_course_year_idx` (`department`, `course`, `year_level`),
  CONSTRAINT `fk_students_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Staff Users
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `staff_users`;
CREATE TABLE `staff_users` (
  `id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `middle_initial` VARCHAR(10) NULL,
  `position` VARCHAR(100) NULL,
  `phone` VARCHAR(50) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `signature_url` TEXT NULL,
  `signature_file_name` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_users_profile_id_unique` (`profile_id`),
  KEY `staff_users_is_active_idx` (`is_active`, `id`),
  CONSTRAINT `fk_staff_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Submissions (Medical Clearances)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions` (
  `id` CHAR(36) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `middle_initial` VARCHAR(10) NULL,
  `course` VARCHAR(100) NOT NULL,
  `department` VARCHAR(50) NOT NULL,
  `year_level` VARCHAR(20) NOT NULL DEFAULT '1st Year',
  `academic_year` VARCHAR(50) NOT NULL DEFAULT 'SY 2025-2026',
  `status` ENUM('pending', 'in_review', 'returned', 'resubmitted', 'physical_exam_done', 'approved') NOT NULL DEFAULT 'pending',
  `reviewed_by` CHAR(36) NULL,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `staff_notes` TEXT NULL,
  `age` VARCHAR(20) NULL,
  `sex` VARCHAR(20) NULL,
  `birthday` VARCHAR(50) NULL,
  `civil_status` VARCHAR(50) NULL,
  `contact_number` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `allergy_details` TEXT NULL,
  `had_operation` ENUM('yes', 'no') NULL DEFAULT 'no',
  `operation_details` TEXT NULL,
  `blood_pressure` VARCHAR(50) NULL,
  `weight` VARCHAR(50) NULL,
  `height` VARCHAR(50) NULL,
  `bmi` VARCHAR(50) NULL,
  `lab_test_location` VARCHAR(100) NULL,
  `lab_test_clinic` VARCHAR(150) NULL,
  `cbc_test_clinic` VARCHAR(150) NULL,
  `urinalysis_test_clinic` VARCHAR(150) NULL,
  `xray_test_clinic` VARCHAR(150) NULL,
  PRIMARY KEY (`id`),
  KEY `submissions_status_submitted_at_idx` (`status`, `submitted_at`),
  KEY `submissions_status_updated_at_idx` (`status`, `updated_at`),
  KEY `submissions_student_id_submitted_at_idx` (`student_id`, `submitted_at`),
  KEY `submissions_student_id_status_updated_at_idx` (`student_id`, `status`, `updated_at`),
  KEY `submissions_year_level_status_idx` (`year_level`, `status`),
  KEY `submissions_department_status_idx` (`department`, `status`),
  KEY `submissions_course_status_idx` (`course`, `status`),
  KEY `submissions_academic_year_idx` (`academic_year`),
  KEY `submissions_ay_status_idx` (`academic_year`, `status`),
  KEY `submissions_ay_dept_status_idx` (`academic_year`, `department`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Emergency Contacts
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `emergency_contacts`;
CREATE TABLE `emergency_contacts` (
  `submission_id` CHAR(36) NOT NULL,
  `name` VARCHAR(150) NULL,
  `relationship` VARCHAR(100) NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `fk_emergency_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Medical History
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `medical_history`;
CREATE TABLE `medical_history` (
  `submission_id` CHAR(36) NOT NULL,
  `allergy` TINYINT(1) NOT NULL DEFAULT 0,
  `asthma` TINYINT(1) NOT NULL DEFAULT 0,
  `chicken_pox` TINYINT(1) NOT NULL DEFAULT 0,
  `diabetes` TINYINT(1) NOT NULL DEFAULT 0,
  `dysmenorrhea` TINYINT(1) NOT NULL DEFAULT 0,
  `epilepsy_seizure` TINYINT(1) NOT NULL DEFAULT 0,
  `heart_disorder` TINYINT(1) NOT NULL DEFAULT 0,
  `hepatitis` TINYINT(1) NOT NULL DEFAULT 0,
  `hypertension` TINYINT(1) NOT NULL DEFAULT 0,
  `measles` TINYINT(1) NOT NULL DEFAULT 0,
  `mumps` TINYINT(1) NOT NULL DEFAULT 0,
  `anxiety_disorder` TINYINT(1) NOT NULL DEFAULT 0,
  `panic_attack` TINYINT(1) NOT NULL DEFAULT 0,
  `pneumonia` TINYINT(1) NOT NULL DEFAULT 0,
  `ptb_primary_complex` TINYINT(1) NOT NULL DEFAULT 0,
  `typhoid_fever` TINYINT(1) NOT NULL DEFAULT 0,
  `covid19` TINYINT(1) NOT NULL DEFAULT 0,
  `uti` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `fk_medhistory_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Staff Measurements (Physical Examination)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `staff_measurements`;
CREATE TABLE `staff_measurements` (
  `submission_id` CHAR(36) NOT NULL,
  `blood_pressure` VARCHAR(50) NULL,
  `cardiac_rate` VARCHAR(50) NULL,
  `respiratory_rate` VARCHAR(50) NULL,
  `temperature` VARCHAR(50) NULL,
  `weight` VARCHAR(50) NULL,
  `height` VARCHAR(50) NULL,
  `bmi` VARCHAR(50) NULL,
  `visual_acuity` VARCHAR(100) NULL,
  `skin` VARCHAR(150) NULL,
  `heent` VARCHAR(150) NULL,
  `chest_lungs` VARCHAR(150) NULL,
  `heart` VARCHAR(150) NULL,
  `abdomen` VARCHAR(150) NULL,
  `extremities` VARCHAR(150) NULL,
  `others` TEXT NULL,
  `examined_by` VARCHAR(150) NULL,
  `updated_by` CHAR(36) NULL,
  `examined_by_signature_url` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `fk_measurements_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Laboratory: Chest X-Ray
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `lab_chest_xray`;
CREATE TABLE `lab_chest_xray` (
  `submission_id` CHAR(36) NOT NULL,
  `xray_date` VARCHAR(50) NULL,
  `xray_result` VARCHAR(50) NULL,
  `xray_findings` TEXT NULL,
  `file_id` CHAR(36) NULL,
  `file_url` TEXT NULL,
  `file_name` VARCHAR(255) NULL,
  `mime_type` VARCHAR(100) NULL,
  `media_updated_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `fk_xray_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. Laboratory: CBC
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `lab_cbc`;
CREATE TABLE `lab_cbc` (
  `submission_id` CHAR(36) NOT NULL,
  `cbc_date` VARCHAR(50) NULL,
  `hemoglobin` VARCHAR(50) NULL,
  `hematocrit` VARCHAR(50) NULL,
  `wbc` VARCHAR(50) NULL,
  `platelet_count` VARCHAR(50) NULL,
  `blood_type` VARCHAR(20) NULL,
  `glucose` VARCHAR(50) NULL,
  `protein` VARCHAR(50) NULL,
  `file_id` CHAR(36) NULL,
  `file_url` TEXT NULL,
  `file_name` VARCHAR(255) NULL,
  `mime_type` VARCHAR(100) NULL,
  `media_updated_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `fk_cbc_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. Laboratory: Urinalysis
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `lab_urinalysis`;
CREATE TABLE `lab_urinalysis` (
  `submission_id` CHAR(36) NOT NULL,
  `urinalysis_date` VARCHAR(50) NULL,
  `glucose` VARCHAR(50) NULL,
  `protein` VARCHAR(50) NULL,
  `file_id` CHAR(36) NULL,
  `file_url` TEXT NULL,
  `file_name` VARCHAR(255) NULL,
  `mime_type` VARCHAR(100) NULL,
  `media_updated_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `fk_urinalysis_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. Certificates (Clearance Certificates)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `certificates`;
CREATE TABLE `certificates` (
  `submission_id` CHAR(36) NOT NULL,
  `findings_normal` TINYINT(1) NOT NULL DEFAULT 1,
  `diagnosis` TEXT NULL,
  `remarks` TEXT NULL,
  `purpose` VARCHAR(150) NULL,
  `control_no` VARCHAR(100) NULL,
  `issued_date` DATE NULL,
  `issued_at` DATETIME NULL,
  `license_no` VARCHAR(100) NULL,
  `signatory_name` VARCHAR(150) NULL,
  `pdf_url` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`submission_id`),
  KEY `certificates_control_no_idx` (`control_no`),
  CONSTRAINT `fk_cert_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. Files (Master Storage Registry)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `files`;
CREATE TABLE `files` (
  `id` CHAR(36) NOT NULL,
  `submission_id` CHAR(36) NULL,
  `type` VARCHAR(50) NOT NULL, -- 'photo', 'signature', 'xray', 'cbc', 'urinalysis', 'announcement'
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `url` TEXT NOT NULL,
  `storage_bucket` VARCHAR(100) NOT NULL DEFAULT 'local',
  `storage_path` TEXT NOT NULL,
  `storage_provider` VARCHAR(50) NOT NULL DEFAULT 'local', -- 'local', 'cloudinary', 'supabase'
  `cloudinary_public_id` VARCHAR(255) NULL,
  `cloudinary_resource_type` VARCHAR(50) NULL,
  `cloudinary_version` VARCHAR(50) NULL,
  `cloudinary_folder` VARCHAR(255) NULL,
  `uploaded_by` CHAR(36) NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `files_submission_type_uploaded_at_idx` (`submission_id`, `type`, `uploaded_at`),
  KEY `files_uploaded_by_type_idx` (`uploaded_by`, `type`, `uploaded_at`),
  KEY `files_storage_provider_idx` (`storage_provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. Announcements
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `date_posted` DATE NOT NULL,
  `image_path` TEXT NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `announcements_published_date_idx` (`is_published`, `date_posted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. Student Notifications
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `student_notifications`;
CREATE TABLE `student_notifications` (
  `id` CHAR(36) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `submission_id` CHAR(36) NOT NULL,
  `notification_key` VARCHAR(100) NOT NULL,
  `status` ENUM('approved', 'returned') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `note` TEXT NULL,
  `action_label` VARCHAR(100) NOT NULL,
  `action_path` VARCHAR(255) NOT NULL,
  `year_label` VARCHAR(50) NOT NULL,
  `occurred_at` DATETIME NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_notifications_student_key_unique` (`student_id`, `notification_key`),
  KEY `student_notifications_student_occurred_idx` (`student_id`, `occurred_at`),
  KEY `student_notifications_unread_idx` (`student_id`, `is_read`, `occurred_at`),
  KEY `student_notifications_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `fk_notif_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 16. Archived Accounts
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `archived_accounts`;
CREATE TABLE `archived_accounts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `original_profile_data` JSON NULL,
  `archived_by` CHAR(36) NULL,
  `archived_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `archived_accounts_user_id_idx` (`user_id`),
  KEY `archived_accounts_role_archived_at_idx` (`role`, `archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 17. OCR Calls Log
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `ocr_calls_log`;
CREATE TABLE `ocr_calls_log` (
  `id` CHAR(36) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `provider` VARCHAR(50) NOT NULL, -- 'azure', 'ocr-space'
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ocr_calls_provider_created_idx` (`provider`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 18. Audit Logs (Data Privacy Act of 2012 / HIPAA Compliance)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `role` VARCHAR(50) NULL,
  `action` VARCHAR(100) NOT NULL, -- 'FILE_VIEW', 'FILE_UPLOAD', 'STATUS_CHANGE', etc.
  `target_student_id` VARCHAR(50) NULL,
  `submission_id` CHAR(36) NULL,
  `file_id` CHAR(36) NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_idx` (`user_id`, `created_at`),
  KEY `audit_logs_target_student_idx` (`target_student_id`, `created_at`),
  KEY `audit_logs_action_idx` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 19. Personal Access Tokens (Sanctum Auth)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `personal_access_tokens`;
CREATE TABLE `personal_access_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(191) NOT NULL,
  `tokenable_id` CHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `abilities` TEXT NULL,
  `last_used_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
