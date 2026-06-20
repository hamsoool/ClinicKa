// @ts-nocheck
import {
  createTimedValue,
  forbidden,
  getValidCachedValue,
  isStaffRole,
  normalizeNamePart,
  supabase,
} from "./context.ts";
import type { Requester, TimedValue } from "./context.ts";
import {
  formatStaffDisplayName,
  getArchivedUserIds,
  loadStaffUsersByIds,
} from "./requester.ts";
import { getSafeAdminSystemSettings } from "./settings.ts";
import {
  normalizeFileRows,
  normalizeProfileAssetRows,
  normalizeStaffSignatureRows,
} from "./storage.ts";
import { getCachedData, invalidateCache, setCachedData } from "./redis.ts";

const ANALYTICS_CACHE_TTL_MS = 30_000;
const SUBMISSIONS_CACHE_TTL_MS = 15_000;
const STUDENT_RECORDS_CACHE_TTL_MS = 20_000;
const STAFF_DASHBOARD_OVERVIEW_TTL_MS = 15_000;
const STAFF_SUBMISSION_REPORT_SUMMARIES_TTL_MS = 30_000;
const STAFF_SUBMISSION_SUMMARIES_TTL_MS = 20_000;
const STAFF_APPROVED_STUDENTS_TTL_MS = 30_000;
const STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS = 20;
const STAFF_DASHBOARD_DEPARTMENTS = ["CCS", "CBA", "CEAS", "CHTM", "CAHS"];
const STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE = 25;
const STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE = 100;
const STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE = 20;
const STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE = 50;
const SUBMISSION_ACCESS_COLUMNS = "id,student_id,status,reviewed_by";
const STAFF_USER_SELECT_WITH_SIGNATURE =
  "id,profile_id,first_name,last_name,middle_initial,position,name,signature_url";
const STAFF_USER_SELECT_LEGACY =
  "id,profile_id,first_name,last_name,middle_initial,position,name";
const ACTIVE_STAFF_USER_SELECT_WITH_SIGNATURE =
  "id,profile_id,first_name,last_name,middle_initial,position,name,is_active,signature_url";
const ACTIVE_STAFF_USER_SELECT_LEGACY =
  "id,profile_id,first_name,last_name,middle_initial,position,name,is_active";
const CERTIFICATE_SELECT_COLUMNS =
  "submission_id,findings_normal,diagnosis,remarks,purpose,control_no,issued_date,issued_at,license_no,signatory_name,pdf_url";
const STAFF_MEASUREMENTS_SELECT_WITH_SIGNATURE =
  "submission_id,blood_pressure,cardiac_rate,respiratory_rate,temperature,weight,height,bmi,visual_acuity,skin,heent,chest_lungs,heart,abdomen,extremities,others,examined_by,updated_by,updated_at,examined_by_signature_url";
const STAFF_MEASUREMENTS_SELECT_LEGACY =
  "submission_id,blood_pressure,cardiac_rate,respiratory_rate,temperature,weight,height,bmi,visual_acuity,skin,heent,chest_lungs,heart,abdomen,extremities,others,examined_by,updated_by,updated_at";

export const SUBMISSION_LIST_COLUMNS = [
  "id",
  "student_id",
  "first_name",
  "last_name",
  "middle_initial",
  "course",
  "department",
  "year_level",
  "academic_year",
  "status",
  "reviewed_by",
  "submitted_at",
  "updated_at",
  "staff_notes",
  "age",
  "sex",
  "birthday",
  "civil_status",
  "contact_number",
  "address",
  "allergy_details",
  "had_operation",
  "operation_details",
  "blood_pressure",
  "weight",
  "height",
  "bmi",
  "lab_test_location",
  "lab_test_clinic",
  "cbc_test_clinic",
  "urinalysis_test_clinic",
  "xray_test_clinic",
].join(",");

const SUBMISSION_SUMMARY_COLUMNS = [
  "id",
  "student_id",
  "first_name",
  "last_name",
  "middle_initial",
  "course",
  "department",
  "year_level",
  "academic_year",
  "status",
  "reviewed_by",
  "submitted_at",
  "updated_at",
].join(",");

let analyticsReadCache: TimedValue<Record<string, number>> | null = null;
let analyticsReadPromise: Promise<Record<string, number>> | null = null;
let submissionsReadCache: TimedValue<any[]> | null = null;
let submissionsReadPromise: Promise<any[]> | null = null;
const studentRecordsReadCache = new Map<string, TimedValue<any[]>>();
const studentRecordsReadPromises = new Map<string, Promise<any[]>>();
let staffDashboardOverviewCache: TimedValue<any> | null = null;
let staffDashboardOverviewPromise: Promise<any> | null = null;
let staffSubmissionReportSummariesCache: TimedValue<any> | null = null;
let staffSubmissionReportSummariesPromise: Promise<any> | null = null;
let staffSubmissionStatusCountsCache: TimedValue<any> | null = null;
let staffSubmissionStatusCountsPromise: Promise<any> | null = null;
const staffSubmissionSummariesCache = new Map<string, TimedValue<any>>();
const staffSubmissionSummariesPromises = new Map<string, Promise<any>>();
const staffApprovedStudentsCache = new Map<string, TimedValue<any>>();
const staffApprovedStudentsPromises = new Map<string, Promise<any>>();

export function invalidateDashboardReadCaches() {
  analyticsReadCache = null;
  analyticsReadPromise = null;
  submissionsReadCache = null;
  submissionsReadPromise = null;
  studentRecordsReadCache.clear();
  studentRecordsReadPromises.clear();
  staffDashboardOverviewCache = null;
  staffDashboardOverviewPromise = null;
  staffSubmissionReportSummariesCache = null;
  staffSubmissionReportSummariesPromise = null;
  staffSubmissionStatusCountsCache = null;
  staffSubmissionStatusCountsPromise = null;
  staffSubmissionSummariesCache.clear();
  staffSubmissionSummariesPromises.clear();
  staffApprovedStudentsCache.clear();
  staffApprovedStudentsPromises.clear();

  const promise = invalidateCache([
    "analytics:admin_overview",
    "analytics:staff_dashboard_overview",
    "analytics:staff_submission_report_summaries",
    "analytics:staff_submission_status_counts",
    "analytics:submissions_list",
    "admin:staff_users",
    "admin:user_accounts",
    "admin:super_admin_administrators",
    "admin:archived_accounts"
  ]).catch((error) => console.error("Redis invalidation error:", error));
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") {
    edgeRuntime.waitUntil(promise);
  }
}

export function invalidateStudentRecordsCache(studentId?: string | null) {
  const cacheKey = String(studentId || "").trim();
  if (!cacheKey) return;
  studentRecordsReadCache.delete(cacheKey);
  studentRecordsReadPromises.delete(cacheKey);

  const promise = invalidateCache(`records:student:${cacheKey}`)
    .catch((error) => console.error("Redis invalidation error:", error));
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") {
    edgeRuntime.waitUntil(promise);
  }
}

function mapMedicalHistory(row: any) {
  if (!row) return undefined;

  return {
    allergy: row.allergy,
    asthma: row.asthma,
    chickenPox: row.chicken_pox,
    diabetes: row.diabetes,
    dysmenorrhea: row.dysmenorrhea,
    epilepsySeizure: row.epilepsy_seizure,
    heartDisorder: row.heart_disorder,
    hepatitis: row.hepatitis,
    hypertension: row.hypertension,
    measles: row.measles,
    mumps: row.mumps,
    anxietyDisorder: row.anxiety_disorder,
    panicAttack: row.panic_attack,
    pneumonia: row.pneumonia,
    ptbPrimaryComplex: row.ptb_primary_complex,
    typhoidFever: row.typhoid_fever,
    covid19: row.covid19,
    uti: row.uti,
  };
}

function mapStaffMeasurements(row: any, examinedBySignatureUrl?: string | null) {
  if (!row) return undefined;

  return {
    bloodPressure: row.blood_pressure,
    cardiacRate: row.cardiac_rate,
    respiratoryRate: row.respiratory_rate,
    temperature: row.temperature,
    weight: row.weight,
    height: row.height,
    bmi: row.bmi,
    visualAcuity: row.visual_acuity,
    skin: row.skin,
    heent: row.heent,
    chestLungs: row.chest_lungs,
    heart: row.heart,
    abdomen: row.abdomen,
    extremities: row.extremities,
    others: row.others,
    examinedBy: row.examined_by,
    examinedBySignatureUrl: normalizeStorageFileUrl(row.examined_by_signature_url || examinedBySignatureUrl || null) || undefined,
    updatedAt: row.updated_at || null,
  };
}

function latestFilesByType(files: any[]) {
  return files.reduce((acc, file) => {
    const existing = acc[file.type];
    if (
      !existing ||
      new Date(file.uploaded_at).getTime() >
      new Date(existing.uploaded_at).getTime()
    ) {
      acc[file.type] = file;
    }
    return acc;
  }, {} as Record<string, any>);
}

function byId(rows: any[] | null | undefined) {
  return (rows || []).reduce((acc, row) => {
    if (row?.id) acc[row.id] = row;
    return acc;
  }, {} as Record<string, any>);
}

function normalizeStorageFileUrl(url?: string | null) {
  const trimmed = String(url || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    return hostname === "res.cloudinary.com" || hostname.endsWith(".cloudinary.com")
      ? trimmed
      : undefined;
  } catch {
    return undefined;
  }
}

function findLabFileByHint(files: any[], hint: string) {
  const keys = hint.toLowerCase() === "xray"
    ? ["xray", "x-ray", "chest"]
    : hint.toLowerCase() === "cbc"
      ? ["cbc", "blood", "complete blood count", "hematology"]
      : ["urinalysis", "urine", "ua", "u/a"];

  return (files || []).find((file) => {
    const name = String(file?.file_name || "").toLowerCase();
    const path = String(file?.storage_path || "").toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    return keys.some((key) => name.includes(key) || path.includes(key) || type.includes(key));
  }) || null;
}

function findGenericLabFile(files: any[]) {
  return (files || []).find((file) => {
    const type = String(file?.type || "").toLowerCase();
    if (["photo", "signature", "certificate"].includes(type)) return false;
    const mimeType = String(file?.mime_type || "").toLowerCase();
    const name = String(file?.file_name || "").toLowerCase();
    return mimeType.includes("pdf") ||
      mimeType.includes("image") ||
      /\.(pdf|png|jpe?g|webp|gif)$/i.test(name);
  }) || null;
}

function buildStaffSignatureAssetFromRow(staff: any) {
  const signatureUrl = normalizeStorageFileUrl(staff?.signature_url || null);
  if (!signatureUrl || !staff?.id) return null;

  return {
    id: `staff-user-signature-${staff.id}`,
    submission_id: null,
    type: "staff_signature",
    file_name: null,
    storage_bucket: null,
    storage_path: null,
    mime_type: null,
    uploaded_at: null,
    uploaded_by: staff.profile_id || null,
    url: signatureUrl,
  };
}

function resolveStaffSignatureById(staffId: unknown, related: Record<string, any>) {
  const normalizedStaffId = String(staffId || "").trim();
  if (!normalizedStaffId) return null;

  return (
    related.staffSignaturesByStaffId?.[normalizedStaffId]
    || buildStaffSignatureAssetFromRow(related.reviewers?.[normalizedStaffId])
    || null
  );
}

function buildStudentProfileAssetFromRow(student: any, type: "photo" | "signature") {
  const url = type === "photo"
    ? normalizeStorageFileUrl(student?.profile_photo_url || null)
    : normalizeStorageFileUrl(student?.signature_url || null);
  if (!url) return null;

  return {
    id: `student-${type}-${student?.student_id || student?.profile_id || "asset"}`,
    submission_id: null,
    type,
    file_name: type === "photo"
      ? student?.profile_photo_file_name || null
      : student?.signature_file_name || null,
    storage_bucket: null,
    storage_path: null,
    mime_type: null,
    uploaded_at: student?.media_updated_at || null,
    uploaded_by: student?.profile_id || null,
    url,
  };
}

function buildLabFileAssetFromRow(row: any, type: string) {
  const url = normalizeStorageFileUrl(row?.file_url || null);
  if (!url) return null;

  return {
    id: row?.file_id || `${type}-${row?.submission_id || "file"}`,
    submission_id: row?.submission_id || null,
    type,
    file_name: row?.file_name || null,
    storage_bucket: null,
    storage_path: null,
    mime_type: row?.mime_type || null,
    uploaded_at: row?.media_updated_at || null,
    uploaded_by: null,
    url,
  };
}

function isMissingStaffSignatureUrlColumnError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("signature_url") && message.includes("staff_users");
}

function isMissingExaminedBySignatureUrlColumnError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("examined_by_signature_url") && message.includes("staff_measurements");
}

function isMissingFilesTableError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("public.files") ||
    (message.includes("relation") && message.includes("files") && message.includes("does not exist")) ||
    (message.includes("could not find the table") && message.includes("files")) ||
    (message.includes("schema cache") && message.includes("files"))
  );
}

async function fetchStaffUsersByIds(staffIds: string[]) {
  if (!staffIds.length) {
    return { data: [] as any[], error: null };
  }

  const primary = await supabase
    .from("staff_users")
    .select(STAFF_USER_SELECT_WITH_SIGNATURE)
    .in("id", staffIds);

  if (!primary.error || !isMissingStaffSignatureUrlColumnError(primary.error)) {
    return primary;
  }

  return supabase
    .from("staff_users")
    .select(STAFF_USER_SELECT_LEGACY)
    .in("id", staffIds);
}

async function fetchActiveStaffDirectory() {
  const primary = await supabase
    .from("staff_users")
    .select(ACTIVE_STAFF_USER_SELECT_WITH_SIGNATURE)
    .eq("is_active", true)
    .limit(200);

  if (!primary.error || !isMissingStaffSignatureUrlColumnError(primary.error)) {
    return primary;
  }

  return supabase
    .from("staff_users")
    .select(ACTIVE_STAFF_USER_SELECT_LEGACY)
    .eq("is_active", true)
    .limit(200);
}

async function fetchStaffMeasurementsBySubmissionIds(submissionIds: string[]) {
  if (!submissionIds.length) {
    return { data: [] as any[], error: null };
  }

  const primary = await supabase
    .from("staff_measurements")
    .select(STAFF_MEASUREMENTS_SELECT_WITH_SIGNATURE)
    .in("submission_id", submissionIds);

  if (!primary.error || !isMissingExaminedBySignatureUrlColumnError(primary.error)) {
    return primary;
  }

  return supabase
    .from("staff_measurements")
    .select(STAFF_MEASUREMENTS_SELECT_LEGACY)
    .in("submission_id", submissionIds);
}

const CLEARANCE_SIGNATORY_NAMES = ["GERALD S. BERNAL, MD", "ARMANDO TAMAYO, MD"] as const;

function normalizeSignatureName(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b(m\.?\s*d\.?|doctor|dr\.?|rn|r\.?\s*n\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isClearanceSignatoryName(value?: string | null) {
  const normalized = normalizeSignatureName(value);
  return Boolean(
    normalized &&
    CLEARANCE_SIGNATORY_NAMES.some((name) => normalizeSignatureName(name) === normalized),
  );
}

function staffNameMatchesExaminer(staff: any, examinerName?: string | null) {
  const normalizedExaminer = normalizeSignatureName(examinerName);
  if (!staff || !normalizedExaminer) return false;

  const candidates = [
    formatStaffDisplayName(staff),
    staff?.name,
    [staff?.first_name, staff?.middle_initial, staff?.last_name].filter(Boolean).join(" "),
    [staff?.first_name, staff?.last_name].filter(Boolean).join(" "),
  ]
    .map((value) => normalizeSignatureName(value))
    .filter(Boolean);

  if (candidates.includes(normalizedExaminer)) return true;

  const examinerTokens = new Set(normalizedExaminer.split(" ").filter(Boolean));
  const firstName = normalizeSignatureName(staff?.first_name).split(" ")[0] || "";
  const lastNameParts = normalizeSignatureName(staff?.last_name).split(" ").filter(Boolean);
  const lastName = lastNameParts[lastNameParts.length - 1] || "";

  return Boolean(firstName && lastName && examinerTokens.has(firstName) && examinerTokens.has(lastName));
}

function resolveExaminerSignature(row: any, staffMeasurements: any, related: Record<string, any>) {
  const directSignature = [
    staffMeasurements?.updated_by,
    row.reviewed_by,
  ]
    .map((staffId) => resolveStaffSignatureById(staffId, related))
    .find(Boolean);

  if (directSignature) {
    return directSignature;
  }

  const examinedBy = staffMeasurements?.examined_by || "";
  const staffRows = related.staffRows || [];
  const matchedStaff = staffRows.find(
    (staff: any) => staffNameMatchesExaminer(staff, examinedBy) && resolveStaffSignatureById(staff?.id, related),
  );
  if (matchedStaff) {
    return resolveStaffSignatureById(matchedStaff.id, related);
  }

  return null;
}

function mapSubmission(row: any, related: Record<string, any>) {
  const student = related.students[row.student_id] || {};
  const emergencyContact = related.emergencyContacts[row.id];
  const medicalHistory = related.medicalHistory[row.id];
  const staffMeasurements = related.staffMeasurements[row.id];
  const reviewer = related.reviewers[row.reviewed_by] || null;
  const examinerSignature = resolveExaminerSignature(row, staffMeasurements, related);
  const xray = related.xray[row.id];
  const cbc = related.cbc[row.id];
  const urinalysis = related.urinalysis[row.id];
  const certificate = related.certificates[row.id];
  const files = latestFilesByType(related.files[row.id] || []);
  const submissionFiles = related.files[row.id] || [];
  const xrayFileFromLab = xray?.file_id ? related.filesById?.[xray.file_id] : null;
  const cbcFileFromLab = cbc?.file_id ? related.filesById?.[cbc.file_id] : null;
  const urinalysisFileFromLab = urinalysis?.file_id
    ? related.filesById?.[urinalysis.file_id]
    : null;
  const directXrayFile = buildLabFileAssetFromRow(xray, "xray");
  const directCbcFile = buildLabFileAssetFromRow(cbc, "cbc");
  const directUrinalysisFile = buildLabFileAssetFromRow(urinalysis, "urinalysis");
  const xrayFileByHint = findLabFileByHint(submissionFiles, "xray");
  const cbcFileByHint = findLabFileByHint(submissionFiles, "cbc");
  const urinalysisFileByHint = findLabFileByHint(submissionFiles, "urinalysis");
  const genericLabFile = findGenericLabFile(submissionFiles);
  const metadataProfileAssets = student?.profile_id
    ? related.profileAssetsByProfileId?.[student.profile_id] || {}
    : related.profileAssetsByStudentId?.[row.student_id] || {};
  const profileAssets = {
    ...metadataProfileAssets,
    ...(buildStudentProfileAssetFromRow(student, "photo")
      ? { photo: buildStudentProfileAssetFromRow(student, "photo") }
      : {}),
    ...(buildStudentProfileAssetFromRow(student, "signature")
      ? { signature: buildStudentProfileAssetFromRow(student, "signature") }
      : {}),
  };

  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || student.first_name || "",
    lastName: row.last_name || student.last_name || "",
    middleInitial: row.middle_initial || student.middle_initial || "",
    course: row.course || student.course || "",
    department: row.department || student.department || "",
    year: String(row.year_level || ""),
    studentYearLevel: student?.year_level ? String(student.year_level) : "",
    academicYear: row.academic_year || undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedByStaffId: row.reviewed_by || undefined,
    reviewedByName: formatStaffDisplayName(reviewer) || undefined,
    reviewedByPosition: normalizeNamePart(reviewer?.position) || undefined,
    staffNotes: row.staff_notes,
    age: row.age ? String(row.age) : student.age ? String(student.age) : "",
    sex: row.sex || student.sex || "",
    birthday: row.birthday || student.birthday || "",
    civilStatus: row.civil_status || student.civil_status || "",
    contactNumber: row.contact_number || student.contact_number || "",
    address: row.address || student.address || "",
    allergyDetails: row.allergy_details,
    hadOperation: row.had_operation,
    operationDetails: row.operation_details,
    bloodPressure: row.blood_pressure,
    weight: row.weight,
    height: row.height,
    bmi: row.bmi,
    emergencyContact: emergencyContact
      ? {
        name: emergencyContact.name,
        relationship: emergencyContact.relationship,
        phone: emergencyContact.phone,
        address: emergencyContact.address,
      }
      : undefined,
    medicalHistory: mapMedicalHistory(medicalHistory),
    staffMeasurements: mapStaffMeasurements(staffMeasurements, examinerSignature?.url),
    labResults: {
      xrayDate: xray?.xray_date,
      xrayResult: xray?.xray_result,
      xrayFindings: xray?.xray_findings,
      cbcDate: cbc?.cbc_date,
      hemoglobin: cbc?.hemoglobin,
      hematocrit: cbc?.hematocrit,
      wbc: cbc?.wbc,
      plateletCount: cbc?.platelet_count,
      bloodType: cbc?.blood_type,
      glucose: cbc?.glucose,
      protein: cbc?.protein,
      urinalysisDate: urinalysis?.urinalysis_date,
      urinalysisGlucose: urinalysis?.glucose,
      urinalysisProtein: urinalysis?.protein,
    },
    clearanceInfo: certificate
      ? {
        findingsNormal: certificate.findings_normal,
        diagnosis: certificate.diagnosis,
        remarks: certificate.remarks,
        purpose: certificate.purpose,
        controlNo: certificate.control_no,
        issuedDate: certificate.issued_date || certificate.issued_at,
        licenseNo: certificate.license_no,
        signatoryName: certificate.signatory_name,
      }
      : undefined,
    photoUrl: files.photo?.url || profileAssets.photo?.url,
    signatureUrl: files.signature?.url || profileAssets.signature?.url,
    xrayFileUrl:
      directXrayFile?.url || xrayFileFromLab?.url || files.xray?.url || xrayFileByHint?.url || genericLabFile?.url,
    cbcFileUrl:
      directCbcFile?.url || cbcFileFromLab?.url || files.cbc?.url || cbcFileByHint?.url || genericLabFile?.url,
    urinalysisFileUrl:
      directUrinalysisFile?.url || urinalysisFileFromLab?.url || files.urinalysis?.url || urinalysisFileByHint?.url ||
      genericLabFile?.url,
    certificatePdfUrl: files.certificate?.url || certificate?.pdf_url,
    labTestLocation: row.lab_test_location || "",
    otherClinicName: row.lab_test_clinic || "",
    cbcTestClinic: row.cbc_test_clinic || "",
    urinalysisTestClinic: row.urinalysis_test_clinic || "",
    xrayTestClinic: row.xray_test_clinic || "",
  };
}

async function loadRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const reviewerIds = [
    ...new Set(rows.map((row) => row.reviewed_by).filter(Boolean)),
  ];

  const [
    studentsRes,
    emergencyContactsRes,
    medicalHistoryRes,
    staffMeasurementsRes,
    reviewersRes,
    xrayRes,
    cbcRes,
    urinalysisRes,
    certificatesRes,
    filesRes,
  ] = await Promise.all([
    studentIds.length
      ? supabase
        .from("students")
        .select(
          "student_id,profile_id,first_name,last_name,middle_initial,department,course,year_level,age,sex,birthday,civil_status,contact_number,address,profile_photo_url,profile_photo_file_name,signature_url,signature_file_name,media_updated_at",
        )
        .in("student_id", studentIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("emergency_contacts")
        .select("submission_id,name,relationship,phone,address")
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("medical_history")
        .select(
          "submission_id,allergy,asthma,chicken_pox,diabetes,dysmenorrhea,epilepsy_seizure,heart_disorder,hepatitis,hypertension,measles,mumps,anxiety_disorder,panic_attack,pneumonia,ptb_primary_complex,typhoid_fever,covid19,uti",
        )
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? fetchStaffMeasurementsBySubmissionIds(submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    reviewerIds.length
      ? fetchStaffUsersByIds(reviewerIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("lab_chest_xray")
        .select("submission_id,xray_date,xray_result,xray_findings,file_id,file_url,file_name,mime_type,media_updated_at")
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("lab_cbc")
        .select(
          "submission_id,cbc_date,hemoglobin,hematocrit,wbc,platelet_count,blood_type,glucose,protein,file_id,file_url,file_name,mime_type,media_updated_at",
        )
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("lab_urinalysis")
        .select("submission_id,urinalysis_date,glucose,protein,file_id,file_url,file_name,mime_type,media_updated_at")
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("certificates")
        .select(CERTIFICATE_SELECT_COLUMNS)
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
        .from("files")
        .select(
          "id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,uploaded_at,uploaded_by",
        )
        .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  if (filesRes.error && !isMissingFilesTableError(filesRes.error)) {
    console.log("Student records submission files warning:", filesRes.error);
  }

  const normalizedFiles = await normalizeFileRows(filesRes.error ? [] : filesRes.data);
  const filesBySubmission = normalizedFiles.reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);
  const initialReviewerRows = reviewersRes.data || [];
  const knownReviewerIds = new Set(
    initialReviewerRows.map((staff) => String(staff?.id || "").trim()).filter(Boolean),
  );
  const measurementUpdaterIds = [
    ...new Set(
      (staffMeasurementsRes.data || [])
        .map((row) => String(row?.updated_by || "").trim())
        .filter(Boolean),
    ),
  ];
  const missingReviewerIds = measurementUpdaterIds.filter((id) => !knownReviewerIds.has(id));
  const extraReviewersRes = missingReviewerIds.length
    ? await fetchStaffUsersByIds(missingReviewerIds)
    : { data: [] as any[], error: null };

  if (extraReviewersRes.error) {
    throw new Error(extraReviewersRes.error.message);
  }

  const examinedByNames = [
    ...new Set(
      (staffMeasurementsRes.data || [])
        .map((row) => String(row?.examined_by || "").trim())
        .filter(Boolean),
    ),
  ];
  const examinerDirectoryRes = examinedByNames.length
    ? await fetchActiveStaffDirectory()
    : { data: [] as any[], error: null };

  if (examinerDirectoryRes.error) {
    throw new Error(examinerDirectoryRes.error.message);
  }

  const staffRows = Object.values(
    [...initialReviewerRows, ...(extraReviewersRes.data || []), ...(examinerDirectoryRes.data || [])]
      .reduce((acc, staff) => {
        if (staff?.id) acc[staff.id] = staff;
        return acc;
      }, {} as Record<string, any>),
  );
  const staffProfileIds = [
    ...new Set(staffRows.map((staff) => staff?.profile_id).filter(Boolean)),
  ];
  const staffSignatureFilesRes = staffProfileIds.length
    ? await supabase
      .from("files")
      .select(
        "id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,uploaded_at,uploaded_by",
      )
      .in("uploaded_by", staffProfileIds)
      .is("submission_id", null)
      .order("uploaded_at", { ascending: false })
    : { data: [] as any[], error: null };

  if (staffSignatureFilesRes.error) {
    if (!isMissingFilesTableError(staffSignatureFilesRes.error)) {
      console.log("Student records staff signature files warning:", staffSignatureFilesRes.error);
    }
  }

  const normalizedStaffSignatureFiles = normalizeStaffSignatureRows(
    await normalizeFileRows(staffSignatureFilesRes.error ? [] : (staffSignatureFilesRes.data || [])),
  );
  const staffSignaturesByProfileId = normalizedStaffSignatureFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    const existing = acc[file.uploaded_by];
    if (
      !existing ||
      new Date(file.uploaded_at || 0).getTime() >
      new Date(existing.uploaded_at || 0).getTime()
    ) {
      acc[file.uploaded_by] = file;
    }
    return acc;
  }, {} as Record<string, any>);
  const staffSignaturesByStaffId = staffRows.reduce((acc, staff) => {
    if (!staff?.id || !staff?.profile_id) return acc;
    const signature = buildStaffSignatureAssetFromRow(staff) || staffSignaturesByProfileId[staff.profile_id];
    if (signature) acc[staff.id] = signature;
    return acc;
  }, {} as Record<string, any>);
  const studentRows = studentsRes.data || [];
  const studentProfileIds = [
    ...new Set(
      studentRows
        .filter((student) => !student?.profile_photo_url || !student?.signature_url)
        .map((student) => student?.profile_id)
        .filter(Boolean),
    ),
  ];
  const profileAssetFilesRes = studentProfileIds.length
    ? await supabase
      .from("files")
      .select(
        "id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,storage_provider,cloudinary_public_id,cloudinary_resource_type,cloudinary_version,cloudinary_folder,uploaded_at,uploaded_by",
      )
      .in("uploaded_by", studentProfileIds)
      .is("submission_id", null)
      .order("uploaded_at", { ascending: false })
    : { data: [] as any[], error: null };

  if (profileAssetFilesRes.error) {
    if (!isMissingFilesTableError(profileAssetFilesRes.error)) {
      console.log("Student records profile asset files warning:", profileAssetFilesRes.error);
    }
  }

  const normalizedProfileAssetFiles = normalizeProfileAssetRows(
    await normalizeFileRows(profileAssetFilesRes.error ? [] : (profileAssetFilesRes.data || [])),
  );
  const profileAssetsByUploadedBy = normalizedProfileAssetFiles.reduce((acc, file) => {
    if (!file?.uploaded_by) return acc;
    acc[file.uploaded_by] = acc[file.uploaded_by] || [];
    acc[file.uploaded_by].push(file);
    return acc;
  }, {} as Record<string, any[]>);
  const profileAssetsByProfileId = studentRows.reduce((acc, student) => {
    if (!student?.profile_id) return acc;
    const metadataFiles = profileAssetsByUploadedBy[student.profile_id] || [];
    const latest = latestFilesByType(metadataFiles);
    const directPhoto = buildStudentProfileAssetFromRow(student, "photo");
    const directSignature = buildStudentProfileAssetFromRow(student, "signature");
    acc[student.profile_id] = {
      ...latest,
      ...(directPhoto ? { photo: directPhoto } : {}),
      ...(directSignature ? { signature: directSignature } : {}),
    };
    return acc;
  }, {} as Record<string, Record<string, any>>);
  const profileAssetsByStudentId = studentRows.reduce((acc, student) => {
    if (!student?.student_id) return acc;
    const metadataFiles = student?.profile_id
      ? profileAssetsByUploadedBy[student.profile_id] || []
      : [];
    const latest = latestFilesByType(metadataFiles);
    const directPhoto = buildStudentProfileAssetFromRow(student, "photo");
    const directSignature = buildStudentProfileAssetFromRow(student, "signature");
    acc[student.student_id] = {
      ...latest,
      ...(directPhoto ? { photo: directPhoto } : {}),
      ...(directSignature ? { signature: directSignature } : {}),
    };
    return acc;
  }, {} as Record<string, Record<string, any>>);

  return {
    students: byKey(studentsRes.data, "student_id"),
    emergencyContacts: byKey(emergencyContactsRes.data, "submission_id"),
    medicalHistory: byKey(medicalHistoryRes.data, "submission_id"),
    staffMeasurements: byKey(staffMeasurementsRes.data, "submission_id"),
    reviewers: byKey(staffRows, "id"),
    staffRows,
    staffSignaturesByStaffId,
    xray: byKey(xrayRes.data, "submission_id"),
    cbc: byKey(cbcRes.data, "submission_id"),
    urinalysis: byKey(urinalysisRes.data, "submission_id"),
    certificates: byKey(certificatesRes.data, "submission_id"),
    profileAssetsByProfileId,
    profileAssetsByStudentId,
    files: filesBySubmission,
    filesById: byId(normalizedFiles),
  };
}

export async function getMappedSubmissions(queryBuilder: any) {
  const { data, error } = await queryBuilder.order("submitted_at", {
    ascending: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data || [];
  const related = await loadRelatedData(rows);
  return rows.map((row: any) => mapSubmission(row, related));
}

const ACTIONABLE_SUBMISSION_STATUSES = [
  "pending",
  "in_review",
  "returned",
  "resubmitted",
];

function mapSubmissionSummary(
  row: any,
  reviewers: Record<string, any> = {},
  students: Record<string, any> = {},
) {
  const reviewer = reviewers[row.reviewed_by] || null;
  const student = students[row.student_id] || null;
  return {
    id: row.id,
    studentId: row.student_id || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    middleInitial: row.middle_initial || "",
    course: row.course || "",
    department: row.department || "",
    year: String(row.year_level || ""),
    studentYearLevel: student?.year_level ? String(student.year_level) : "",
    academicYear: row.academic_year || undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedByStaffId: row.reviewed_by || undefined,
    reviewedByName: formatStaffDisplayName(reviewer) || undefined,
    reviewedByPosition: normalizeNamePart(reviewer?.position) || undefined,
  };
}

async function mapSubmissionSummaries(
  rows: any[],
  reviewerDirectory?: Record<string, any>,
  studentDirectory?: Record<string, any>,
) {
  const resolvedReviewerDirectory = reviewerDirectory ||
    await loadStaffUsersByIds(
      (rows || []).map((row) => row.reviewed_by).filter(Boolean),
    );
  const resolvedStudentDirectory = studentDirectory ||
    await loadActiveStudentsByIds(
      (rows || []).map((row) => row.student_id).filter(Boolean),
    );

  return (rows || []).map((row) =>
    mapSubmissionSummary(row, resolvedReviewerDirectory, resolvedStudentDirectory)
  );
}

function normalizeIlikeValue(value: string) {
  return String(value || "").trim().replace(/[%_,]/g, " ");
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  maxValue: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), maxValue);
}

function normalizePage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function normalizeSortOrder(value: unknown) {
  return String(value || "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeSubmissionStatusFilter(value: unknown) {
  const normalized = String(value || "action_needed").trim().toLowerCase();
  if (normalized === "all" || normalized === "action_needed") return normalized;
  return ACTIONABLE_SUBMISSION_STATUSES.includes(normalized) ||
    normalized === "approved"
    ? normalized
    : "action_needed";
}

function normalizeYearFilter(value: unknown) {
  const normalized = String(value || "").trim();
  return ["1", "2", "3", "4"].includes(normalized) ? normalized : "";
}

function normalizeDateFilter(value: unknown) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function buildSubmissionSummaryCacheKey(input: Record<string, unknown>) {
  return JSON.stringify(input);
}

async function loadStaffSubmissionStatusCounts() {
  const [
    { count: pendingRecords, error: pendingError },
    { count: inReviewRecords, error: inReviewError },
    { count: returnedRecords, error: returnedError },
    { count: resubmittedRecords, error: resubmittedError },
    { count: actionNeededRecords, error: actionNeededError },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_review"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "returned"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "resubmitted"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIONABLE_SUBMISSION_STATUSES),
  ]);

  if (pendingError) throw new Error(pendingError.message);
  if (inReviewError) throw new Error(inReviewError.message);
  if (returnedError) throw new Error(returnedError.message);
  if (resubmittedError) throw new Error(resubmittedError.message);
  if (actionNeededError) throw new Error(actionNeededError.message);

  return {
    pending: (pendingRecords || 0) + (inReviewRecords || 0),
    inReview: inReviewRecords || 0,
    returned: returnedRecords || 0,
    resubmitted: resubmittedRecords || 0,
    actionNeeded: actionNeededRecords || 0,
  };
}

async function getCachedStaffSubmissionStatusCounts() {
  const cached = getValidCachedValue(staffSubmissionStatusCountsCache);
  if (cached) return cached;
  if (staffSubmissionStatusCountsPromise) return staffSubmissionStatusCountsPromise;

  staffSubmissionStatusCountsPromise = (async () => {
    const cacheKey = "analytics:staff_submission_status_counts";
    const redisCached = await getCachedData<any>(cacheKey);
    if (redisCached) {
      staffSubmissionStatusCountsCache = createTimedValue(redisCached, STAFF_SUBMISSION_SUMMARIES_TTL_MS);
      return redisCached;
    }

    const counts = await loadStaffSubmissionStatusCounts();
    staffSubmissionStatusCountsCache = createTimedValue(
      counts,
      STAFF_SUBMISSION_SUMMARIES_TTL_MS,
    );
    await setCachedData(cacheKey, counts);
    return counts;
  })().finally(() => {
    staffSubmissionStatusCountsPromise = null;
  });

  return staffSubmissionStatusCountsPromise;
}

function applySubmissionSummaryFilters(queryBuilder: any, options: any = {}) {
  let query = queryBuilder;
  const statusFilter = normalizeSubmissionStatusFilter(options.statusFilter);
  const searchQuery = normalizeIlikeValue(options.searchQuery || "");
  const departmentFilter = String(options.departmentFilter || "").trim();
  const yearFilter = normalizeYearFilter(options.yearFilter);

  if (statusFilter === "action_needed") {
    query = query.in("status", ACTIONABLE_SUBMISSION_STATUSES);
  } else if (statusFilter === "pending") {
    query = query.in("status", ["pending", "in_review"]);
  } else if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (searchQuery) {
    query = query.or(
      `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%`,
    );
  }

  if (departmentFilter && departmentFilter !== "all") {
    query = query.or(
      `department.eq.${departmentFilter},course.ilike.%${normalizeIlikeValue(departmentFilter)}%`,
    );
  }

  if (yearFilter) {
    query = query.eq("year_level", Number(yearFilter));
  }

  return query;
}

function applyApprovedStudentFilters(queryBuilder: any, options: any = {}) {
  let query = queryBuilder.eq("status", "approved");
  const searchQuery = normalizeIlikeValue(options.searchQuery || "");
  const departmentFilter = String(options.departmentFilter || "").trim();
  const yearFilter = normalizeYearFilter(options.yearFilter);
  const courseFilter = String(options.courseFilter || "").trim();
  const fromDate = normalizeDateFilter(options.fromDate);
  const toDate = normalizeDateFilter(options.toDate);

  if (searchQuery) {
    query = query.or(
      `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%,course.ilike.%${searchQuery}%`,
    );
  }

  if (departmentFilter && departmentFilter !== "all") {
    query = query.or(
      `department.eq.${departmentFilter},course.ilike.%${normalizeIlikeValue(departmentFilter)}%`,
    );
  }

  if (yearFilter) {
    query = query.eq("year_level", Number(yearFilter));
  }

  if (courseFilter && courseFilter !== "all") {
    query = query.eq("course", courseFilter);
  }

  if (fromDate) {
    query = query.gte("updated_at", `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    query = query.lte("updated_at", `${toDate}T23:59:59.999Z`);
  }

  return query;
}

function resolveDashboardDepartmentValue(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return STAFF_DASHBOARD_DEPARTMENTS.includes(normalized) ? normalized : "";
}

function inferDashboardDepartmentFromCourse(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return STAFF_DASHBOARD_DEPARTMENTS.find((department) =>
    normalized.includes(department)
  ) || "";
}

function resolveDashboardDepartmentForRow(
  row: any,
  studentDirectory: Record<string, any>,
) {
  const submissionDepartment = resolveDashboardDepartmentValue(row?.department);
  if (submissionDepartment) return submissionDepartment;

  const student = studentDirectory[String(row?.student_id || "").trim()] || null;
  const studentDepartment = resolveDashboardDepartmentValue(student?.department);
  if (studentDepartment) return studentDepartment;

  return inferDashboardDepartmentFromCourse(row?.course) ||
    inferDashboardDepartmentFromCourse(student?.course);
}

async function loadStudentDepartmentDirectory(studentIds: string[]) {
  const uniqueStudentIds = [
    ...new Set(
      (studentIds || []).map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ];
  if (!uniqueStudentIds.length) {
    return {} as Record<string, any>;
  }

  const { data, error } = await supabase
    .from("students")
    .select("student_id,department,course")
    .in("student_id", uniqueStudentIds);

  if (error) throw new Error(error.message);

  return (data || []).reduce((acc, student) => {
    const studentId = String(student?.student_id || "").trim();
    if (!studentId) return acc;
    acc[studentId] = student;
    return acc;
  }, {} as Record<string, any>);
}

async function loadStaffDashboardOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  const dayOfWeek = weekStart.getDay();
  const weekOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + weekOffset);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const reportingTermSettings = await getSafeAdminSystemSettings();
  const [academicYearStartValue, academicYearEndValue] = String(reportingTermSettings?.academicYear || "").split("-");
  const academicYearStart = Number.parseInt(academicYearStartValue || "", 10);
  const academicYearEnd = Number.parseInt(academicYearEndValue || "", 10);
  const academicYearStartDate =
    Number.isFinite(academicYearStart) && Number.isFinite(academicYearEnd)
      ? new Date(Date.UTC(academicYearStart, 6, 1))
      : new Date(Date.UTC(today.getUTCFullYear(), 6, 1));
  const academicYearEndDate =
    Number.isFinite(academicYearStart) && Number.isFinite(academicYearEnd)
      ? new Date(Date.UTC(academicYearEnd, 6, 1))
      : new Date(Date.UTC(today.getUTCFullYear() + 1, 6, 1));

  const [
    { count: totalSubmissions, error: totalSubmissionsError },
    { count: approvedRecords, error: approvedError },
    { count: pendingRecords, error: pendingError },
    { count: inReviewRecords, error: inReviewError },
    { count: returnedRecords, error: returnedError },
    { count: resubmittedRecords, error: resubmittedError },
    { count: submittedToday, error: todayError },
    { count: submittedYesterday, error: yesterdayError },
    { count: submittedThisWeek, error: weekError },
    { count: submittedThisMonth, error: monthError },
    { count: submittedThisAcademicYear, error: academicYearError },
    { data: pendingQueueRows, error: pendingQueueError },
    { data: inReviewQueueRows, error: inReviewQueueError },
    { data: returnedQueueRows, error: returnedQueueError },
    { data: resubmittedQueueRows, error: resubmittedQueueError },
    departmentCountResults,
  ] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq(
      "status",
      "approved",
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq(
      "status",
      "pending",
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq(
      "status",
      "in_review",
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq(
      "status",
      "returned",
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq(
      "status",
      "resubmitted",
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).gte(
      "submitted_at",
      today.toISOString(),
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).gte(
      "submitted_at",
      yesterday.toISOString(),
    ).lt("submitted_at", today.toISOString()),
    supabase.from("submissions").select("id", { count: "exact", head: true }).gte(
      "submitted_at",
      weekStart.toISOString(),
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).gte(
      "submitted_at",
      monthStart.toISOString(),
    ),
    supabase.from("submissions").select("id", { count: "exact", head: true }).gte(
      "submitted_at",
      academicYearStartDate.toISOString(),
    ).lt("submitted_at", academicYearEndDate.toISOString()),
    supabase
      .from("submissions")
      .select(SUBMISSION_SUMMARY_COLUMNS)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false })
      .limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    supabase
      .from("submissions")
      .select(SUBMISSION_SUMMARY_COLUMNS)
      .eq("status", "in_review")
      .order("submitted_at", { ascending: false })
      .limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    supabase
      .from("submissions")
      .select(SUBMISSION_SUMMARY_COLUMNS)
      .eq("status", "returned")
      .order("submitted_at", { ascending: false })
      .limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    supabase
      .from("submissions")
      .select(SUBMISSION_SUMMARY_COLUMNS)
      .eq("status", "resubmitted")
      .order("submitted_at", { ascending: false })
      .limit(STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS),
    Promise.all(
      STAFF_DASHBOARD_DEPARTMENTS.map((department) =>
        supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .or(`department.eq.${department},course.ilike.%${department}%`)
          .then((result) => ({ department, ...result })),
      ),
    ),
  ]);

  if (totalSubmissionsError) throw new Error(totalSubmissionsError.message);
  if (approvedError) throw new Error(approvedError.message);
  if (pendingError) throw new Error(pendingError.message);
  if (inReviewError) throw new Error(inReviewError.message);
  if (returnedError) throw new Error(returnedError.message);
  if (resubmittedError) throw new Error(resubmittedError.message);
  if (todayError) throw new Error(todayError.message);
  if (yesterdayError) throw new Error(yesterdayError.message);
  if (weekError) throw new Error(weekError.message);
  if (monthError) throw new Error(monthError.message);
  if (academicYearError) throw new Error(academicYearError.message);
  if (pendingQueueError) throw new Error(pendingQueueError.message);
  if (inReviewQueueError) throw new Error(inReviewQueueError.message);
  if (returnedQueueError) throw new Error(returnedQueueError.message);
  if (resubmittedQueueError) throw new Error(resubmittedQueueError.message);

  for (const result of departmentCountResults || []) {
    if (result.error) throw new Error(result.error.message);
  }

  const reviewerDirectory = await loadStaffUsersByIds([
    ...(pendingQueueRows || []).map((row: any) => row.reviewed_by),
    ...(inReviewQueueRows || []).map((row: any) => row.reviewed_by),
    ...(returnedQueueRows || []).map((row: any) => row.reviewed_by),
    ...(resubmittedQueueRows || []).map((row: any) => row.reviewed_by),
  ]);
  const studentDirectory = await loadActiveStudentsByIds([
    ...(pendingQueueRows || []).map((row: any) => row.student_id),
    ...(inReviewQueueRows || []).map((row: any) => row.student_id),
    ...(returnedQueueRows || []).map((row: any) => row.student_id),
    ...(resubmittedQueueRows || []).map((row: any) => row.student_id),
  ]);

  const [
    pendingQueueItems,
    inReviewQueueItems,
    returnedQueueItems,
    resubmittedQueueItems,
  ] = await Promise.all([
    mapSubmissionSummaries(pendingQueueRows || [], reviewerDirectory, studentDirectory),
    mapSubmissionSummaries(inReviewQueueRows || [], reviewerDirectory, studentDirectory),
    mapSubmissionSummaries(returnedQueueRows || [], reviewerDirectory, studentDirectory),
    mapSubmissionSummaries(resubmittedQueueRows || [], reviewerDirectory, studentDirectory),
  ]);
  const departmentBreakdown = (departmentCountResults || []).map((result: any) => ({
    department: result.department,
    count: result.count || 0,
  }));

  return {
    totalSubmissions: totalSubmissions || 0,
    approvedRecords: approvedRecords || 0,
    pendingRecords: pendingRecords || 0,
    inReviewRecords: inReviewRecords || 0,
    returnedRecords: returnedRecords || 0,
    resubmittedRecords: resubmittedRecords || 0,
    actionableRecords: (pendingRecords || 0) + (inReviewRecords || 0) +
      (returnedRecords || 0) + (resubmittedRecords || 0),
    submittedToday: submittedToday || 0,
    submittedYesterday: submittedYesterday || 0,
    submittedThisWeek: submittedThisWeek || 0,
    submittedThisMonth: submittedThisMonth || 0,
    submittedThisAcademicYear: submittedThisAcademicYear || 0,
    academicYearLabel: reportingTermSettings?.academicYear || "",
    pendingQueueItems,
    inReviewQueueItems,
    returnedQueueItems,
    resubmittedQueueItems,
    departmentBreakdown,
  };
}

async function loadPagedReportRows(buildQuery: (from: number, to: number) => any) {
  const pageSize = 1000;
  const rows: any[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message);

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function loadReportStudentRows() {
  const columnsWithCreatedAt =
    "student_id,profile_id,first_name,last_name,department,course,year_level,sex,created_at";
  const columnsWithoutCreatedAt =
    "student_id,profile_id,first_name,last_name,department,course,year_level,sex";

  try {
    return await loadPagedReportRows((from, to) =>
      supabase
        .from("students")
        .select(columnsWithCreatedAt)
        .order("student_id", { ascending: true })
        .range(from, to)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
    if (!message.includes("created_at")) {
      throw error;
    }

    return await loadPagedReportRows((from, to) =>
      supabase
        .from("students")
        .select(columnsWithoutCreatedAt)
        .order("student_id", { ascending: true })
        .range(from, to)
    );
  }
}

async function loadArchivedReportProfileIds() {
  try {
    const rows = await loadPagedReportRows((from, to) =>
      supabase
        .from("archived_accounts")
        .select("user_id")
        .range(from, to)
    );

    return new Set((rows || []).map((row) => String(row?.user_id || "").trim()).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function buildRegisteredStudentReportSummaries(
  studentRows: any[],
  profileRows: any[],
  archivedProfileIds: Set<string>,
) {
  const studentById = new Map<string, any>();
  const studentByProfileId = new Map<string, any>();

  (studentRows || []).forEach((student) => {
    const studentId = String(student?.student_id || "").trim();
    const profileId = String(student?.profile_id || "").trim();
    if (studentId) {
      studentById.set(studentId, student);
    }
    if (profileId) {
      studentByProfileId.set(profileId, student);
    }
  });

  const studentsByReportId = new Map<string, any>();
  const reportProfileIds = new Set<string>();

  (profileRows || []).forEach((profile) => {
    const profileId = String(profile?.id || "").trim();
    if (profileId && archivedProfileIds.has(profileId)) return;

    const profileStudentId = String(profile?.student_id || "").trim();
    const student = (profileStudentId && studentById.get(profileStudentId)) ||
      (profileId && studentByProfileId.get(profileId)) ||
      {};
    const studentId = String(profileStudentId || student?.student_id || profileId || "").trim();
    if (!studentId) return;

    const resolvedProfileId = profileId || String(student?.profile_id || "").trim();
    if (resolvedProfileId) {
      reportProfileIds.add(resolvedProfileId);
    }

    studentsByReportId.set(studentId, {
      studentId,
      profileId: resolvedProfileId || undefined,
      firstName: student.first_name || profile.first_name || undefined,
      lastName: student.last_name || profile.last_name || undefined,
      department: student.department || profile.department || undefined,
      course: student.course || profile.course || undefined,
      year: String(student.year_level || ""),
      studentYearLevel: String(student.year_level || ""),
      sex: student.sex || undefined,
      registeredAt: profile.created_at || student.created_at || profile.updated_at || undefined,
    });
  });

  (studentRows || []).forEach((student) => {
    const studentId = String(student?.student_id || "").trim();
    const profileId = String(student?.profile_id || "").trim();
    if (!studentId || studentsByReportId.has(studentId)) return;
    if (profileId && archivedProfileIds.has(profileId)) return;
    if (profileId && reportProfileIds.has(profileId)) return;

    studentsByReportId.set(studentId, {
      studentId,
      profileId: profileId || undefined,
      firstName: student.first_name || undefined,
      lastName: student.last_name || undefined,
      department: student.department || undefined,
      course: student.course || undefined,
      year: String(student.year_level || ""),
      studentYearLevel: String(student.year_level || ""),
      sex: student.sex || undefined,
      registeredAt: student.created_at || undefined,
    });
  });

  return [...studentsByReportId.values()];
}

async function loadStaffSubmissionReportSummaries() {
  const [submissionRows, studentRows, profileRows, archivedProfileIds] = await Promise.all([
    loadPagedReportRows((from, to) =>
      supabase
        .from("submissions")
        .select("id,student_id,department,course,year_level,sex,status,submitted_at,updated_at,academic_year")
        .order("submitted_at", { ascending: false })
        .range(from, to)
    ),
    loadReportStudentRows(),
    loadPagedReportRows((from, to) =>
      supabase
        .from("profiles")
        .select("id,student_id,first_name,last_name,department,course,created_at,updated_at")
        .eq("role", "student")
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    loadArchivedReportProfileIds(),
  ]);

  return {
    submissions: (submissionRows || []).map((row) => ({
      id: row.id,
      studentId: row.student_id || "",
      firstName: "",
      lastName: "",
      department: row.department || "",
      course: row.course || "",
      year: String(row.year_level || ""),
      studentYearLevel: String(row.year_level || ""),
      sex: row.sex || "",
      status: row.status || "pending",
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at || undefined,
      academicYear: row.academic_year || undefined,
    })),
    registeredStudents: buildRegisteredStudentReportSummaries(
      studentRows || [],
      profileRows || [],
      archivedProfileIds,
    ),
  };
}

export async function getCachedStaffSubmissionReportSummaries() {
  const cached = getValidCachedValue(staffSubmissionReportSummariesCache);
  if (cached) return cached;
  if (staffSubmissionReportSummariesPromise) return staffSubmissionReportSummariesPromise;

  staffSubmissionReportSummariesPromise = (async () => {
    const cacheKey = "analytics:staff_submission_report_summaries";
    const redisCached = await getCachedData<any>(cacheKey);
    if (redisCached) {
      staffSubmissionReportSummariesCache = createTimedValue(redisCached, STAFF_SUBMISSION_REPORT_SUMMARIES_TTL_MS);
      return redisCached;
    }

    const reportSummaries = await loadStaffSubmissionReportSummaries();
    staffSubmissionReportSummariesCache = createTimedValue(
      reportSummaries,
      STAFF_SUBMISSION_REPORT_SUMMARIES_TTL_MS,
    );
    await setCachedData(cacheKey, reportSummaries);
    return reportSummaries;
  })().finally(() => {
    staffSubmissionReportSummariesPromise = null;
  });

  return staffSubmissionReportSummariesPromise;
}

export async function getCachedStaffDashboardOverview() {
  const cached = getValidCachedValue(staffDashboardOverviewCache);
  if (cached) return cached;
  if (staffDashboardOverviewPromise) return staffDashboardOverviewPromise;

  staffDashboardOverviewPromise = (async () => {
    const cacheKey = "analytics:staff_dashboard_overview";
    const redisCached = await getCachedData<any>(cacheKey);
    if (redisCached) {
      staffDashboardOverviewCache = createTimedValue(redisCached, STAFF_DASHBOARD_OVERVIEW_TTL_MS);
      return redisCached;
    }

    const overview = await loadStaffDashboardOverview();
    staffDashboardOverviewCache = createTimedValue(
      overview,
      STAFF_DASHBOARD_OVERVIEW_TTL_MS,
    );
    await setCachedData(cacheKey, overview);
    return overview;
  })().finally(() => {
    staffDashboardOverviewPromise = null;
  });

  return staffDashboardOverviewPromise;
}

async function loadStaffSubmissionSummaries(options: any = {}) {
  const page = normalizePage(options.page);
  const pageSize = normalizePositiveInteger(
    options.pageSize,
    STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE,
    STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE,
  );
  const sortOrder = normalizeSortOrder(options.sortOrder);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("submissions").select(SUBMISSION_SUMMARY_COLUMNS, {
    count: "exact",
  });
  query = applySubmissionSummaryFilters(query, options);
  query = query.order("submitted_at", {
    ascending: sortOrder === "asc",
  }).range(from, to);

  const [{ data, error, count }, statusCounts] = await Promise.all([
    query,
    getCachedStaffSubmissionStatusCounts(),
  ]);

  if (error) throw new Error(error.message);
  const studentDirectory = await loadActiveStudentsByIds(
    (data || []).map((row: any) => row.student_id),
  );
  const items = await mapSubmissionSummaries(data || [], undefined, studentDirectory);

  return {
    items,
    total: count || 0,
    page,
    pageSize,
    counts: statusCounts,
  };
}

export async function getCachedStaffSubmissionSummaries(options: any = {}) {
  const normalized = {
    searchQuery: String(options.searchQuery || "").trim(),
    statusFilter: normalizeSubmissionStatusFilter(options.statusFilter),
    departmentFilter: String(options.departmentFilter || "").trim(),
    yearFilter: normalizeYearFilter(options.yearFilter),
    sortOrder: normalizeSortOrder(options.sortOrder),
    page: normalizePage(options.page),
    pageSize: normalizePositiveInteger(
      options.pageSize,
      STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE,
      STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE,
    ),
  };
  const cacheKey = buildSubmissionSummaryCacheKey(normalized);
  const cached = getValidCachedValue(staffSubmissionSummariesCache.get(cacheKey));
  if (cached) return cached;

  const inFlight = staffSubmissionSummariesPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const redisKey = `analytics:submission_summaries:${cacheKey}`;
    const redisCached = await getCachedData<any>(redisKey);
    if (redisCached) {
      staffSubmissionSummariesCache.set(cacheKey, createTimedValue(redisCached, STAFF_SUBMISSION_SUMMARIES_TTL_MS));
      return redisCached;
    }

    const result = await loadStaffSubmissionSummaries(normalized);
    staffSubmissionSummariesCache.set(
      cacheKey,
      createTimedValue(result, STAFF_SUBMISSION_SUMMARIES_TTL_MS),
    );
    await setCachedData(redisKey, result);
    return result;
  })().finally(() => {
    staffSubmissionSummariesPromises.delete(cacheKey);
  });

  staffSubmissionSummariesPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

async function loadActiveStudentsByIds(studentIds: string[]) {
  const uniqueStudentIds = [
    ...new Set(
      (studentIds || []).map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ];
  if (!uniqueStudentIds.length) {
    return {} as Record<string, any>;
  }

  const [{ data, error }, archivedUsers] = await Promise.all([
    supabase
      .from("students")
      .select("student_id,profile_id,first_name,last_name,middle_initial,department,course,year_level")
      .in("student_id", uniqueStudentIds),
    getArchivedUserIds().catch(() => ({
      available: false,
      userIds: new Set<string>(),
    })),
  ]);

  if (error) throw new Error(error.message);

  return (data || []).reduce((acc, student) => {
    const studentId = String(student?.student_id || "").trim();
    const profileId = String(student?.profile_id || "").trim();
    const isArchived = archivedUsers.available && profileId
      ? archivedUsers.userIds.has(profileId)
      : false;
    if (!studentId || !profileId || isArchived) {
      return acc;
    }
    acc[studentId] = student;
    return acc;
  }, {} as Record<string, any>);
}

async function loadApprovedStudents(options: any = {}) {
  const page = normalizePage(options.page);
  const pageSize = normalizePositiveInteger(
    options.pageSize,
    STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE,
    STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE,
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("submissions").select(SUBMISSION_SUMMARY_COLUMNS, {
    count: "exact",
  });
  query = applyApprovedStudentFilters(query, options);
  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const activeStudentsById = await loadActiveStudentsByIds(
    (data || []).map((row: any) => row.student_id),
  );

  const groups = new Map<string, any>();

  for (const row of data || []) {
    const summary = mapSubmissionSummary(row);
    const activeStudent = activeStudentsById[summary.studentId];
    if (!summary.studentId || !activeStudent) continue;

    const existing = groups.get(summary.studentId);
    const currentTimestamp = new Date(
      summary.updatedAt || summary.submittedAt || 0,
    ).getTime();
    const resolvedFirstName = summary.firstName || activeStudent.first_name || "";
    const resolvedLastName = summary.lastName || activeStudent.last_name || "";
    const resolvedMiddleInitial = summary.middleInitial ||
      activeStudent.middle_initial || "";
    const resolvedCourse = summary.course || activeStudent.course || "";
    const resolvedDepartment = summary.department ||
      activeStudent.department || "";

    if (!existing) {
      groups.set(summary.studentId, {
        studentId: summary.studentId,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        middleInitial: resolvedMiddleInitial,
        course: resolvedCourse,
        department: resolvedDepartment,
        latestSubmittedAt: summary.submittedAt,
        latestUpdatedAt: summary.updatedAt,
        approvedCount: 1,
        records: [
          {
            id: summary.id,
            year: summary.year,
            submittedAt: summary.submittedAt,
            updatedAt: summary.updatedAt,
          },
        ],
      });
      continue;
    }

    existing.approvedCount += 1;
    existing.records.push({
      id: summary.id,
      year: summary.year,
      submittedAt: summary.submittedAt,
      updatedAt: summary.updatedAt,
    });

    const existingTimestamp = new Date(
      existing.latestUpdatedAt || existing.latestSubmittedAt || 0,
    ).getTime();
    if (currentTimestamp >= existingTimestamp) {
      existing.firstName = resolvedFirstName;
      existing.lastName = resolvedLastName;
      existing.middleInitial = resolvedMiddleInitial;
      existing.course = resolvedCourse;
      existing.department = resolvedDepartment;
      existing.latestSubmittedAt = summary.submittedAt;
      existing.latestUpdatedAt = summary.updatedAt;
    }
  }

  const students = Array.from(groups.values())
    .map((student) => ({
      ...student,
      records: student.records.sort((a: any, b: any) => {
        const yearDifference = Number.parseInt(a.year || "0", 10) -
          Number.parseInt(b.year || "0", 10);
        if (yearDifference !== 0) return yearDifference;
        return new Date(b.updatedAt || b.submittedAt || 0).getTime() -
          new Date(a.updatedAt || a.submittedAt || 0).getTime();
      }),
    }))
    .sort((a, b) =>
      new Date(b.latestUpdatedAt || b.latestSubmittedAt || 0).getTime() -
      new Date(a.latestUpdatedAt || a.latestSubmittedAt || 0).getTime()
    );

  const availableCourses = Array.from(
    new Set(
      students
        .map((student) => String(student.course || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const total = students.length;

  return {
    students,
    availableCourses,
    total: count || total,
    page,
    pageSize,
  };
}

export async function getCachedApprovedStudents(options: any = {}) {
  const normalized = {
    searchQuery: String(options.searchQuery || "").trim(),
    departmentFilter: String(options.departmentFilter || "").trim(),
    yearFilter: normalizeYearFilter(options.yearFilter),
    courseFilter: String(options.courseFilter || "").trim(),
    fromDate: normalizeDateFilter(options.fromDate),
    toDate: normalizeDateFilter(options.toDate),
    page: normalizePage(options.page),
    pageSize: normalizePositiveInteger(
      options.pageSize,
      STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE,
      STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE,
    ),
  };
  const cacheKey = buildSubmissionSummaryCacheKey(normalized);
  const cached = getValidCachedValue(staffApprovedStudentsCache.get(cacheKey));
  if (cached) return cached;

  const inFlight = staffApprovedStudentsPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const redisKey = `analytics:approved_students:${cacheKey}`;
    const redisCached = await getCachedData<any>(redisKey);
    if (redisCached) {
      staffApprovedStudentsCache.set(cacheKey, createTimedValue(redisCached, STAFF_APPROVED_STUDENTS_TTL_MS));
      return redisCached;
    }

    const result = await loadApprovedStudents(normalized);
    staffApprovedStudentsCache.set(
      cacheKey,
      createTimedValue(result, STAFF_APPROVED_STUDENTS_TTL_MS),
    );
    await setCachedData(redisKey, result);
    return result;
  })().finally(() => {
    staffApprovedStudentsPromises.delete(cacheKey);
  });

  staffApprovedStudentsPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

async function loadAnalyticsSummary() {
  const [
    { count: totalStudents, error: totalStudentsError },
    { count: totalSubmissions, error: totalSubmissionsError },
    { count: pendingRecords, error: pendingError },
    { count: approvedRecords, error: approvedError },
    { count: returnedRecords, error: returnedError },
  ] = await Promise.all([
    supabase.from("students").select("student_id", { count: "exact", head: true }),
    supabase.from("submissions").select("id", { count: "exact", head: true }),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_review"]),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "returned"),
  ]);

  if (totalStudentsError) throw new Error(totalStudentsError.message);
  if (totalSubmissionsError) throw new Error(totalSubmissionsError.message);
  if (pendingError) throw new Error(pendingError.message);
  if (approvedError) throw new Error(approvedError.message);
  if (returnedError) throw new Error(returnedError.message);

  return {
    totalStudents: totalStudents || 0,
    pendingRecords: pendingRecords || 0,
    approvedRecords: approvedRecords || 0,
    returnedRecords: returnedRecords || 0,
    totalSubmissions: totalSubmissions || 0,
  };
}

export async function getCachedAnalyticsSummary() {
  const cached = getValidCachedValue(analyticsReadCache);
  if (cached) return cached;
  if (analyticsReadPromise) return analyticsReadPromise;

  analyticsReadPromise = (async () => {
    const cacheKey = "analytics:admin_overview";
    const redisCached = await getCachedData<any>(cacheKey);
    if (redisCached) {
      analyticsReadCache = createTimedValue(redisCached, ANALYTICS_CACHE_TTL_MS);
      return redisCached;
    }

    const analytics = await loadAnalyticsSummary();
    analyticsReadCache = createTimedValue(analytics, ANALYTICS_CACHE_TTL_MS);
    await setCachedData(cacheKey, analytics);
    return analytics;
  })().finally(() => {
    analyticsReadPromise = null;
  });

  return analyticsReadPromise;
}

export async function getCachedSubmissionsList() {
  const cached = getValidCachedValue(submissionsReadCache);
  if (cached) return cached;
  if (submissionsReadPromise) return submissionsReadPromise;

  submissionsReadPromise = (async () => {
    const cacheKey = "analytics:submissions_list";
    const redisCached = await getCachedData<any>(cacheKey);
    if (redisCached) {
      submissionsReadCache = createTimedValue(redisCached, SUBMISSIONS_CACHE_TTL_MS);
      return redisCached;
    }

    const submissions = await getMappedSubmissions(
      supabase.from("submissions").select(SUBMISSION_LIST_COLUMNS),
    );
    submissionsReadCache = createTimedValue(submissions, SUBMISSIONS_CACHE_TTL_MS);
    await setCachedData(cacheKey, submissions);
    return submissions;
  })().finally(() => {
    submissionsReadPromise = null;
  });

  return submissionsReadPromise;
}

export async function getCachedStudentRecords(studentId: string) {
  const cacheKey = String(studentId || "").trim();
  const cached = getValidCachedValue(studentRecordsReadCache.get(cacheKey));
  if (cached) return cached;

  const inFlight = studentRecordsReadPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const nextPromise = (async () => {
    const redisKey = `records:student:${cacheKey}`;
    const redisCached = await getCachedData<any>(redisKey);
    if (redisCached) {
      studentRecordsReadCache.set(cacheKey, createTimedValue(redisCached, STUDENT_RECORDS_CACHE_TTL_MS));
      return redisCached;
    }

    const records = await getMappedSubmissions(
      supabase
        .from("submissions")
        .select(SUBMISSION_LIST_COLUMNS)
        .eq("student_id", cacheKey),
    );
    studentRecordsReadCache.set(
      cacheKey,
      createTimedValue(records, STUDENT_RECORDS_CACHE_TTL_MS),
    );
    await setCachedData(redisKey, records);
    return records;
  })().finally(() => {
    studentRecordsReadPromises.delete(cacheKey);
  });

  studentRecordsReadPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

export async function requireSubmissionAccess(
  requester: Requester,
  submissionId: string,
  options: { columns?: string } = {},
) {
  const columns = String(options.columns || SUBMISSION_ACCESS_COLUMNS).trim() || SUBMISSION_ACCESS_COLUMNS;
  const { data: submission, error } = await supabase
    .from("submissions")
    .select(columns)
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !submission) {
    return {
      response: new Response(JSON.stringify({ error: "Record not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  if (
    !isStaffRole(requester.profile.role) &&
    requester.profile.student_id !== submission.student_id
  ) {
    return { response: forbidden() };
  }

  return { submission };
}
