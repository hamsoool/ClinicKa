# Gordon College Health Services – ERD (Inferred)

PDF diagram: `ERD.pdf`

This ERD is inferred from the current UI and mock data. It reflects the fields used in:

- `src/app/lib/mock-data.ts`
- `src/app/pages/student/medical-form.tsx`
- `src/app/pages/staff/record-review.tsx`
- `src/app/pages/staff/certificates.tsx`
- `src/app/pages/staff/submissions.tsx`

## Diagram (Mermaid)

```mermaid
erDiagram
  STUDENTS ||--o{ SUBMISSIONS : submits
  SUBMISSIONS ||--|| EMERGENCY_CONTACTS : has
  SUBMISSIONS ||--|| MEDICAL_HISTORY : has
  SUBMISSIONS ||--|| STAFF_MEASUREMENTS : verified_by_staff
  SUBMISSIONS ||--o{ LAB_CHEST_XRAY : includes
  SUBMISSIONS ||--o{ LAB_CBC : includes
  SUBMISSIONS ||--o{ LAB_URINALYSIS : includes
  SUBMISSIONS ||--o{ FILES : uploads
  SUBMISSIONS ||--o{ CERTIFICATES : generates
  STAFF_USERS ||--o{ CERTIFICATES : issues

  STUDENTS {
    string student_id PK
    string first_name
    string last_name
    string middle_initial
    string course
    string sex
    string birthday
    string civil_status
    string contact_number
    string address
  }

  SUBMISSIONS {
    string id PK
    string student_id FK
    string year_level
    string status
    datetime submitted_at
    datetime updated_at
    string staff_notes
    string had_operation
    string operation_details
    string allergy_details
    string blood_pressure
    string weight
    string height
    string bmi
    boolean data_privacy_consent
  }

  EMERGENCY_CONTACTS {
    string submission_id PK, FK
    string name
    string relationship
    string phone
    string address
  }

  MEDICAL_HISTORY {
    string submission_id PK, FK
    boolean allergy
    boolean asthma
    boolean diabetes
    boolean hypertension
    boolean heart_disorder
    boolean anxiety_disorder
    boolean pneumonia
    boolean covid19
    boolean uti
  }

  STAFF_MEASUREMENTS {
    string submission_id PK, FK
    string blood_pressure
    string cardiac_rate
    string respiratory_rate
    string temperature
    string weight
    string height
    string bmi
  }

  LAB_CHEST_XRAY {
    string submission_id FK
    date xray_date
    string xray_result
    string xray_findings
    string file_id FK
  }

  LAB_CBC {
    string submission_id FK
    string hemoglobin
    string hematocrit
    string wbc
    string platelet_count
    string blood_type
    string glucose
    string protein
    string file_id FK
  }

  LAB_URINALYSIS {
    string submission_id FK
    string glucose
    string protein
    string file_id FK
  }

  FILES {
    string id PK
    string submission_id FK
    string type
    string file_name
    string mime_type
    string url
    datetime uploaded_at
  }

  CERTIFICATES {
    string id PK
    string submission_id FK
    string staff_id FK
    datetime issued_at
    string pdf_url
  }

  STAFF_USERS {
    string id PK
    string name
    string email
    string position
    string phone
  }
```

## Table/Column Summary

### STUDENTS
- `student_id` (PK)
- `first_name`
- `last_name`
- `middle_initial`
- `course`
- `sex`
- `birthday`
- `civil_status`
- `contact_number`
- `address`

### SUBMISSIONS
- `id` (PK)
- `student_id` (FK → STUDENTS.student_id)
- `year_level`
- `status`
- `submitted_at`
- `updated_at`
- `staff_notes`
- `had_operation`
- `operation_details`
- `allergy_details`
- `blood_pressure`
- `weight`
- `height`
- `bmi`
- `data_privacy_consent`

### EMERGENCY_CONTACTS
- `submission_id` (PK/FK → SUBMISSIONS.id)
- `name`
- `relationship`
- `phone`
- `address`

### MEDICAL_HISTORY
- `submission_id` (PK/FK → SUBMISSIONS.id)
- `allergy`
- `asthma`
- `diabetes`
- `hypertension`
- `heart_disorder`
- `anxiety_disorder`
- `pneumonia`
- `covid19`
- `uti`

### STAFF_MEASUREMENTS
- `submission_id` (PK/FK → SUBMISSIONS.id)
- `blood_pressure`
- `cardiac_rate`
- `respiratory_rate`
- `temperature`
- `weight`
- `height`
- `bmi`

### LAB_CHEST_XRAY
- `submission_id` (FK → SUBMISSIONS.id)
- `xray_date`
- `xray_result`
- `xray_findings`
- `file_id` (FK → FILES.id)

### LAB_CBC
- `submission_id` (FK → SUBMISSIONS.id)
- `hemoglobin`
- `hematocrit`
- `wbc`
- `platelet_count`
- `blood_type`
- `glucose`
- `protein`
- `file_id` (FK → FILES.id)

### LAB_URINALYSIS
- `submission_id` (FK → SUBMISSIONS.id)
- `glucose`
- `protein`
- `file_id` (FK → FILES.id)

### FILES
- `id` (PK)
- `submission_id` (FK → SUBMISSIONS.id)
- `type` (`signature|xray|cbc|urinalysis`)
- `file_name`
- `mime_type`
- `url`
- `uploaded_at`

### CERTIFICATES
- `id` (PK)
- `submission_id` (FK → SUBMISSIONS.id)
- `staff_id` (FK → STAFF_USERS.id)
- `issued_at`
- `pdf_url`

### STAFF_USERS
- `id` (PK)
- `name`
- `email`
- `position`
- `phone`
