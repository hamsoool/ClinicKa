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
import { normalizeFileRows } from "./storage.ts";

const ANALYTICS_CACHE_TTL_MS = 30_000;
const SUBMISSIONS_CACHE_TTL_MS = 15_000;
const STUDENT_RECORDS_CACHE_TTL_MS = 20_000;
const STAFF_DASHBOARD_OVERVIEW_TTL_MS = 15_000;
const STAFF_SUBMISSION_SUMMARIES_TTL_MS = 20_000;
const STAFF_APPROVED_STUDENTS_TTL_MS = 30_000;
const STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS = 20;
const STAFF_DASHBOARD_DEPARTMENTS = ["CCS", "CBA", "CEAS", "CHTM", "CAHS"];
const STAFF_SUBMISSION_SUMMARIES_DEFAULT_PAGE_SIZE = 25;
const STAFF_SUBMISSION_SUMMARIES_MAX_PAGE_SIZE = 100;
const STAFF_APPROVED_STUDENTS_DEFAULT_PAGE_SIZE = 20;
const STAFF_APPROVED_STUDENTS_MAX_PAGE_SIZE = 50;

export const SUBMISSION_LIST_COLUMNS = [
  "id",
  "student_id",
  "first_name",
  "last_name",
  "middle_initial",
  "course",
  "department",
  "year_level",
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
  staffSubmissionSummariesCache.clear();
  staffSubmissionSummariesPromises.clear();
  staffApprovedStudentsCache.clear();
  staffApprovedStudentsPromises.clear();
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

function mapStaffMeasurements(row: any) {
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

function mapSubmission(row: any, related: Record<string, any>) {
  const student = related.students[row.student_id] || {};
  const emergencyContact = related.emergencyContacts[row.id];
  const medicalHistory = related.medicalHistory[row.id];
  const staffMeasurements = related.staffMeasurements[row.id];
  const reviewer = related.reviewers[row.reviewed_by] || null;
  const xray = related.xray[row.id];
  const cbc = related.cbc[row.id];
  const urinalysis = related.urinalysis[row.id];
  const certificate = related.certificates[row.id];
  const files = latestFilesByType(related.files[row.id] || []);

  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || student.first_name || "",
    lastName: row.last_name || student.last_name || "",
    middleInitial: row.middle_initial || student.middle_initial || "",
    course: row.course || student.course || "",
    department: row.department || student.department || "",
    year: String(row.year_level || student.year_level || ""),
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
    staffMeasurements: mapStaffMeasurements(staffMeasurements),
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
        }
      : undefined,
    photoUrl: files.photo?.url,
    signatureUrl: files.signature?.url,
    xrayFileUrl: files.xray?.url,
    cbcFileUrl: files.cbc?.url,
    urinalysisFileUrl: files.urinalysis?.url,
    certificatePdfUrl: files.certificate?.url || certificate?.pdf_url,
    labTestLocation: row.lab_test_location || "",
    otherClinicName: row.lab_test_clinic || "",
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
            "student_id,profile_id,first_name,last_name,middle_initial,department,course,age,sex,birthday,civil_status,contact_number,address",
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
      ? supabase
          .from("staff_measurements")
          .select(
            "submission_id,blood_pressure,cardiac_rate,respiratory_rate,temperature,weight,height,bmi,visual_acuity,skin,heent,chest_lungs,heart,abdomen,extremities,others,examined_by",
          )
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    reviewerIds.length
      ? supabase
          .from("staff_users")
          .select("id,first_name,last_name,middle_initial,position,name")
          .in("id", reviewerIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from("lab_chest_xray")
          .select("submission_id,xray_date,xray_result,xray_findings,file_id")
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from("lab_cbc")
          .select(
            "submission_id,cbc_date,hemoglobin,hematocrit,wbc,platelet_count,blood_type,glucose,protein,file_id",
          )
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from("lab_urinalysis")
          .select("submission_id,urinalysis_date,glucose,protein,file_id")
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from("certificates")
          .select(
            "submission_id,findings_normal,diagnosis,remarks,purpose,control_no,issued_date,issued_at,pdf_url",
          )
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase
          .from("files")
          .select(
            "id,submission_id,type,file_name,mime_type,url,storage_bucket,storage_path,uploaded_at,uploaded_by",
          )
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const normalizedFiles = await normalizeFileRows(filesRes.data);
  const filesBySubmission = normalizedFiles.reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(studentsRes.data, "student_id"),
    emergencyContacts: byKey(emergencyContactsRes.data, "submission_id"),
    medicalHistory: byKey(medicalHistoryRes.data, "submission_id"),
    staffMeasurements: byKey(staffMeasurementsRes.data, "submission_id"),
    reviewers: byKey(reviewersRes.data, "id"),
    xray: byKey(xrayRes.data, "submission_id"),
    cbc: byKey(cbcRes.data, "submission_id"),
    urinalysis: byKey(urinalysisRes.data, "submission_id"),
    certificates: byKey(certificatesRes.data, "submission_id"),
    files: filesBySubmission,
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

function mapSubmissionSummary(row: any, reviewers: Record<string, any> = {}) {
  const reviewer = reviewers[row.reviewed_by] || null;
  return {
    id: row.id,
    studentId: row.student_id || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    middleInitial: row.middle_initial || "",
    course: row.course || "",
    department: row.department || "",
    year: String(row.year_level || ""),
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
) {
  const resolvedReviewerDirectory = reviewerDirectory ||
    await loadStaffUsersByIds(
      (rows || []).map((row) => row.reviewed_by).filter(Boolean),
    );

  return (rows || []).map((row) => mapSubmissionSummary(row, resolvedReviewerDirectory));
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
      normalized === "approved" ||
      normalized === "physical_exam_done"
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

function applySubmissionSummaryFilters(queryBuilder: any, options: any = {}) {
  let query = queryBuilder;
  const statusFilter = normalizeSubmissionStatusFilter(options.statusFilter);
  const searchQuery = normalizeIlikeValue(options.searchQuery || "");
  const departmentFilter = String(options.departmentFilter || "").trim();
  const yearFilter = normalizeYearFilter(options.yearFilter);

  if (statusFilter === "action_needed") {
    query = query.in("status", ACTIONABLE_SUBMISSION_STATUSES);
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
    { count: submittedToday, error: todayError },
    { count: submittedYesterday, error: yesterdayError },
    { count: submittedThisWeek, error: weekError },
    { count: submittedThisMonth, error: monthError },
    { count: submittedThisAcademicYear, error: academicYearError },
    { data: actionableRows, error: actionableRowsError },
    { data: latestRowsUniverse, error: latestRowsUniverseError },
    { data: departmentSourceRows, error: departmentSourceError },
  ] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq(
      "status",
      "approved",
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
      .in("status", ACTIONABLE_SUBMISSION_STATUSES)
      .order("submitted_at", { ascending: false })
      .limit(2000),
    supabase
      .from("submissions")
      .select(SUBMISSION_SUMMARY_COLUMNS)
      .order("submitted_at", { ascending: false })
      .limit(5000),
    supabase.from("submissions").select("student_id,department,course"),
  ]);

  if (totalSubmissionsError) throw new Error(totalSubmissionsError.message);
  if (approvedError) throw new Error(approvedError.message);
  if (todayError) throw new Error(todayError.message);
  if (yesterdayError) throw new Error(yesterdayError.message);
  if (weekError) throw new Error(weekError.message);
  if (monthError) throw new Error(monthError.message);
  if (academicYearError) throw new Error(academicYearError.message);
  if (actionableRowsError) throw new Error(actionableRowsError.message);
  if (latestRowsUniverseError) throw new Error(latestRowsUniverseError.message);
  if (departmentSourceError) throw new Error(departmentSourceError.message);

  const latestByStudentYear = new Map<string, any>();
  for (const row of latestRowsUniverse || []) {
    const key = `${String(row?.student_id || "").trim()}:${String(row?.year_level || "").trim()}`;
    if (!key || key === ":") continue;
    const existing = latestByStudentYear.get(key);
    if (!existing) {
      latestByStudentYear.set(key, row);
      continue;
    }
    const existingTs = new Date(existing.updated_at || existing.submitted_at || 0).getTime();
    const nextTs = new Date(row.updated_at || row.submitted_at || 0).getTime();
    if (nextTs >= existingTs) {
      latestByStudentYear.set(key, row);
    }
  }

  const latestActionableRows = [...latestByStudentYear.values()].filter((row) =>
    ACTIONABLE_SUBMISSION_STATUSES.includes(String(row?.status || "")),
  );
  const pendingRowsAll = latestActionableRows
    .filter((row) => row.status === "pending")
    .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
  const inReviewRowsAll = latestActionableRows
    .filter((row) => row.status === "in_review")
    .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
  const returnedRowsAll = latestActionableRows
    .filter((row) => row.status === "returned")
    .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
  const resubmittedRowsAll = latestActionableRows
    .filter((row) => row.status === "resubmitted")
    .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());

  const pendingQueueRows = pendingRowsAll.slice(0, STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS);
  const inReviewQueueRows = inReviewRowsAll.slice(0, STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS);
  const returnedQueueRows = returnedRowsAll.slice(0, STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS);
  const resubmittedQueueRows = resubmittedRowsAll.slice(0, STAFF_DASHBOARD_QUEUE_LIMIT_PER_STATUS);

  const pendingRecords = pendingRowsAll.length;
  const inReviewRecords = inReviewRowsAll.length;
  const returnedRecords = returnedRowsAll.length;
  const resubmittedRecords = resubmittedRowsAll.length;

  const [reviewerDirectory, studentDepartmentDirectory] = await Promise.all([
    loadStaffUsersByIds([
      ...(pendingQueueRows || []).map((row: any) => row.reviewed_by),
      ...(inReviewQueueRows || []).map((row: any) => row.reviewed_by),
      ...(returnedQueueRows || []).map((row: any) => row.reviewed_by),
      ...(resubmittedQueueRows || []).map((row: any) => row.reviewed_by),
    ]),
    loadStudentDepartmentDirectory(
      (departmentSourceRows || []).map((row: any) => row.student_id),
    ),
  ]);

  const [
    pendingQueueItems,
    inReviewQueueItems,
    returnedQueueItems,
    resubmittedQueueItems,
  ] = await Promise.all([
    mapSubmissionSummaries(pendingQueueRows || [], reviewerDirectory),
    mapSubmissionSummaries(inReviewQueueRows || [], reviewerDirectory),
    mapSubmissionSummaries(returnedQueueRows || [], reviewerDirectory),
    mapSubmissionSummaries(resubmittedQueueRows || [], reviewerDirectory),
  ]);
  const departmentCounts = STAFF_DASHBOARD_DEPARTMENTS.reduce((acc, department) => {
    acc[department] = 0;
    return acc;
  }, {} as Record<string, number>);

  (departmentSourceRows || []).forEach((row: any) => {
    const department = resolveDashboardDepartmentForRow(
      row,
      studentDepartmentDirectory,
    );
    if (!department) return;
    departmentCounts[department] = (departmentCounts[department] || 0) + 1;
  });

  const departmentBreakdown = STAFF_DASHBOARD_DEPARTMENTS.map((department) => ({
    department,
    count: departmentCounts[department] || 0,
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

export async function getCachedStaffDashboardOverview() {
  const cached = getValidCachedValue(staffDashboardOverviewCache);
  if (cached) return cached;
  if (staffDashboardOverviewPromise) return staffDashboardOverviewPromise;

  staffDashboardOverviewPromise = (async () => {
    const overview = await loadStaffDashboardOverview();
    staffDashboardOverviewCache = createTimedValue(
      overview,
      STAFF_DASHBOARD_OVERVIEW_TTL_MS,
    );
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

  const [{ data, error, count }, overview] = await Promise.all([
    query,
    getCachedStaffDashboardOverview(),
  ]);

  if (error) throw new Error(error.message);
  const items = await mapSubmissionSummaries(data || []);

  return {
    items,
    total: count || 0,
    page,
    pageSize,
    counts: {
      pending: overview.pendingRecords,
      inReview: overview.inReviewRecords,
      returned: overview.returnedRecords,
      resubmitted: overview.resubmittedRecords,
      actionNeeded: overview.actionableRecords,
    },
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
    const result = await loadStaffSubmissionSummaries(normalized);
    staffSubmissionSummariesCache.set(
      cacheKey,
      createTimedValue(result, STAFF_SUBMISSION_SUMMARIES_TTL_MS),
    );
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
      .select("student_id,profile_id,first_name,last_name,middle_initial,department,course")
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

  let query = supabase.from("submissions").select(SUBMISSION_SUMMARY_COLUMNS);
  query = applyApprovedStudentFilters(query, options);
  query = query.order("updated_at", { ascending: false });

  const { data, error } = await query;
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
  const from = (page - 1) * pageSize;
  const paginatedStudents = students.slice(from, from + pageSize);

  return {
    students: paginatedStudents,
    availableCourses,
    total,
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
    const result = await loadApprovedStudents(normalized);
    staffApprovedStudentsCache.set(
      cacheKey,
      createTimedValue(result, STAFF_APPROVED_STUDENTS_TTL_MS),
    );
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
    const analytics = await loadAnalyticsSummary();
    analyticsReadCache = createTimedValue(analytics, ANALYTICS_CACHE_TTL_MS);
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
    const submissions = await getMappedSubmissions(
      supabase.from("submissions").select(SUBMISSION_LIST_COLUMNS),
    );
    submissionsReadCache = createTimedValue(submissions, SUBMISSIONS_CACHE_TTL_MS);
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
) {
  const { data: submission, error } = await supabase
    .from("submissions")
    .select("*")
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
