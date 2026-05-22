// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import {
  badRequest,
  bucketName,
  buildCorsHeaders,
  forbidden,
  internalServerError,
  isAdminRole,
  isDoctorOrAdmin,
  isDoctorPosition,
  isStaffRole,
  isSuperAdminRole,
  minPasswordLength,
  normalizeEmail,
  passwordLengthError,
  requestLoggingEnabled,
  resolveCorsOrigin,
  signedStorageUrlExpiresSeconds,
  storageBuckets,
  supabase,
  unauthorized,
} from "./context.ts";
import type { Requester } from "./context.ts";
import { sendStatusNotificationEmail } from "./notifications.ts";
import {
  archivedAccountsMigrationRequired,
  authenticate,
  clearArchivedAuthState,
  deriveStudentIdFromEmail,
  formatStaffDisplayName,
  getArchivedAccountsTableState,
  getArchivedUserIds,
  invalidateArchivedCaches,
  isRejectedGoogleUser,
  loadStaffUsersByIds,
  purgeRejectedGoogleUser,
  reassignAdministratorOwnedRows,
  requireActiveRequester,
  roleLabel,
  setArchivedAuthState,
} from "./requester.ts";
import {
  getAdminSystemSettings,
  getSafeAdminSystemSettings,
  getStudentNotificationStateKey,
  normalizeAdminSystemSettings,
  normalizeStudentNotificationState,
} from "./settings.ts";
import {
  deleteStoragePrefixes,
  ensureBucket,
  ensureStorageBucket,
  normalizeFileRows,
} from "./storage.ts";
import {
  getCachedAnalyticsSummary,
  getCachedApprovedStudents,
  getCachedStaffDashboardOverview,
  getCachedStaffSubmissionSummaries,
  getCachedStudentRecords,
  getCachedSubmissionsList,
  getMappedSubmissions,
  invalidateDashboardReadCaches,
  requireSubmissionAccess,
  SUBMISSION_LIST_COLUMNS,
} from "./submissions.ts";

const app = new Hono().basePath("/server");

async function findLatestProfileAssetInStorage(studentId: string, fileType: "photo" | "signature") {
  const targetStudentId = String(studentId || "").trim();
  if (!targetStudentId) return null;

  const bucket = fileType === "photo" ? "profile" : "student_signature";
  const prefixes = [`${targetStudentId}/`, `profiles/${targetStudentId}/`];
  const candidates: Array<{ name: string; prefix: string; updatedAt: number }> = [];

  for (const prefix of prefixes) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 100,
        offset: 0,
      });
      if (error || !data?.length) continue;

      for (const item of data) {
        const name = String(item?.name || "").trim();
        if (!name) continue;
        const lowerName = name.toLowerCase();
        if (!(lowerName === fileType || lowerName.startsWith(`${fileType}.`) || lowerName.startsWith(`${fileType}_`))) {
          continue;
        }
        const updatedAt = new Date(
          String(item?.updated_at || item?.created_at || item?.last_accessed_at || 0),
        ).getTime();
        candidates.push({ name, prefix, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 });
      }
    } catch (error) {
      console.log(`Profile asset storage list warning (${bucket}):`, error);
    }
  }

  const latest = candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!latest) return null;

  const storagePath = `${latest.prefix}${latest.name}`;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

  if (signedUrlError) {
    console.log(`Profile asset signed URL warning (${bucket}):`, signedUrlError.message);
    return null;
  }

  return {
    url: signedUrlData?.signedUrl || null,
    fileName: latest.name,
  };
}

if (requestLoggingEnabled) {
  app.use('*', logger(console.log));
}

app.use(
  "/*",
  cors({
    origin: (origin) => resolveCorsOrigin(origin) || null,
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
});

app.options('*', (c) => new Response(null, {
  status: 204,
  headers: buildCorsHeaders(c.req.header('Origin')),
}));

function getRequesterStudentId(requester: Requester) {
  return String(requester.student?.student_id || requester.profile?.student_id || '').trim();
}

app.get("/health", (c) => c.json({ status: "ok" }));

// Authentication and shared session helpers.
app.post("/auth/reject-google-account", async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return unauthorized();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return unauthorized();
  }

  const user = authData.user;
  if (!isRejectedGoogleUser(user)) {
    return c.json({ success: true, deleted: false });
  }

  try {
    await purgeRejectedGoogleUser(user);
    return c.json({ success: true, deleted: true });
  } catch (error) {
    console.log('Failed to purge rejected Google user:', error);
    return internalServerError(c, 'Failed to reject unauthorized Google account', error);
  }
});

app.get("/me", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  return c.json({
    profile: requester.profile,
    student: requester.student,
    staff: requester.staff,
  });
});

// Student routes.
app.put("/student-profile", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const data = await c.req.json();
    const studentId = requester.profile.student_id || requester.student?.student_id || data.studentId;

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    const firstName = String(data.firstName || '').trim() || null;
    const lastName = String(data.lastName || '').trim() || null;
    const middleInitial = String(data.middleInitial || '').trim() || null;
    const department = String(data.department || '').trim() || null;
    const course = String(data.course || '').trim() || null;
    const age = data.age ? Number(data.age) : null;
    const sex = String(data.sex || '').trim() || null;
    const birthday = String(data.birthday || '').trim() || null;
    const civilStatus = String(data.civilStatus || '').trim() || null;
    const contactNumber = String(data.contactNumber || '').trim() || null;
    const address = String(data.address || '').trim() || null;
    const submissionCategory = String(data.submissionCategory || '').trim() || null;
    const rawSubmissionTargetYearLevel = data.submissionTargetYearLevel;
    const submissionTargetYearLevel =
      rawSubmissionTargetYearLevel === null || rawSubmissionTargetYearLevel === undefined || rawSubmissionTargetYearLevel === ""
        ? null
        : Number(rawSubmissionTargetYearLevel);

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        department,
        course,
        student_id: studentId,
      })
      .eq('id', requester.profile.id)
      .select('*')
      .single();

    if (profileError || !updatedProfile) {
      throw new Error(profileError?.message || 'Failed to update profile');
    }

    const studentPayload = {
      student_id: studentId,
      profile_id: requester.profile.id,
      first_name: firstName,
      last_name: lastName,
      middle_initial: middleInitial,
      department,
      course,
      age: Number.isFinite(age) ? age : null,
      sex,
      birthday,
      civil_status: civilStatus,
      contact_number: contactNumber,
      address,
      submission_category: submissionCategory,
      submission_target_year_level: Number.isFinite(submissionTargetYearLevel) ? submissionTargetYearLevel : null,
    };

    let updatedStudent = null;
    let studentError = null;
    const studentWrite = await supabase
      .from('students')
      .upsert(studentPayload, {
        onConflict: 'student_id',
      })
      .select('*')
      .single();

    updatedStudent = studentWrite.data;
    studentError = studentWrite.error;

    const missingStudentColumns =
      String(studentError?.message || '').includes('submission_category') ||
      String(studentError?.message || '').includes('submission_target_year_level');

    if (studentError && missingStudentColumns) {
      const fallbackWrite = await supabase
        .from('students')
        .upsert({
          student_id: studentId,
          profile_id: requester.profile.id,
          first_name: firstName,
          last_name: lastName,
          middle_initial: middleInitial,
          department,
          course,
          age: Number.isFinite(age) ? age : null,
          sex,
          birthday,
          civil_status: civilStatus,
          contact_number: contactNumber,
          address,
        }, {
          onConflict: 'student_id',
        })
        .select('*')
        .single();

      updatedStudent = fallbackWrite.data;
      studentError = fallbackWrite.error;
    }

    if (studentError || !updatedStudent) {
      throw new Error(studentError?.message || 'Failed to update student record');
    }

    return c.json({
      success: true,
      profile: updatedProfile,
      student: updatedStudent,
    });
  } catch (error) {
    console.log('Error updating student profile:', error);
    return internalServerError(c, 'Failed to update student profile', error);
  }
});

app.post("/student-profile-asset", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const fileType = String(formData.get('fileType') || '').trim().toLowerCase();
    const requestedStudentId = String(formData.get('studentId') || '').trim();
    const studentId =
      requester.profile.student_id ||
      requester.student?.student_id ||
      requestedStudentId;

    if (!file || !fileType) {
      return badRequest('file and fileType are required');
    }

    if (fileType !== 'photo' && fileType !== 'signature') {
      return badRequest('Unsupported profile asset type');
    }

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    if (file.size > 5 * 1024 * 1024) {
      return badRequest('Profile photo and signature must be 5 MB or smaller.');
    }

    const targetBucket = fileType === 'photo' ? 'profile' : 'student_signature';
    const safeFileName = String(file.name || `${fileType}.bin`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${studentId}/${fileType}_${Date.now()}_${safeFileName}`;
    const fileBuffer = await file.arrayBuffer();

    await ensureStorageBucket(targetBucket);

    try {
      await deleteStoragePrefixes([targetBucket], [`${studentId}/`, `profiles/${studentId}/`]);
    } catch (cleanupError) {
      console.log('Profile asset cleanup warning:', cleanupError);
    }

    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: insertedFile, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        submission_id: null,
        type: fileType,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        url: null,
        storage_bucket: targetBucket,
        storage_path: storagePath,
        uploaded_by: requester.profile.id,
      })
      .select('*')
      .single();

    if (fileInsertError || !insertedFile) {
      console.log('Profile asset metadata warning:', fileInsertError?.message || 'Missing inserted metadata row');
    } else {
      try {
        await supabase
          .from('files')
          .delete()
          .eq('uploaded_by', requester.profile.id)
          .is('submission_id', null)
          .eq('type', fileType)
          .neq('id', insertedFile.id);
      } catch (metadataCleanupError) {
        console.log('Profile asset cleanup warning:', metadataCleanupError);
      }
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(targetBucket)
      .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

    if (signedUrlError) {
      throw new Error(signedUrlError.message);
    }

    return c.json({
      success: true,
      url: signedUrlData?.signedUrl || null,
      fileName: storagePath,
    });
  } catch (error) {
    console.log('Error uploading student profile asset:', error);
    return internalServerError(c, 'Failed to upload student profile asset', error);
  }
});

app.get("/student-profile-assets", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const requestedStudentId = String(c.req.query("studentId") || "").trim();
    const requesterStudentId =
      requester.profile.student_id || requester.student?.student_id || "";
    const targetStudentId = requestedStudentId || requesterStudentId;

    if (requester.profile.role === "student" && targetStudentId !== requesterStudentId) {
      return forbidden();
    }

    const targetProfileId = requester.student?.profile_id || requester.profile.id;
    if (!targetProfileId) {
      return c.json({
        success: true,
        photoUrl: null,
        signatureUrl: null,
        photoFileName: null,
        signatureFileName: null,
      });
    }

    const { data: assetRows, error: assetError } = await supabase
      .from("files")
      .select("id,type,file_name,storage_bucket,storage_path,mime_type,uploaded_at,url")
      .eq("uploaded_by", targetProfileId)
      .is("submission_id", null)
      .in("type", ["photo", "signature"])
      .order("uploaded_at", { ascending: false })
      .limit(20);

    if (assetError) {
      throw new Error(assetError.message);
    }

    const normalizedRows = await normalizeFileRows(assetRows || []);
    const latestByType = (normalizedRows || []).reduce((acc, row) => {
      const type = String(row?.type || "").trim().toLowerCase();
      if (!type || acc[type]) return acc;
      acc[type] = row;
      return acc;
    }, {} as Record<string, any>);

    const storagePhoto =
      !latestByType.photo && targetStudentId
        ? await findLatestProfileAssetInStorage(targetStudentId, "photo")
        : null;
    const storageSignature =
      !latestByType.signature && targetStudentId
        ? await findLatestProfileAssetInStorage(targetStudentId, "signature")
        : null;

    return c.json({
      success: true,
      photoUrl: latestByType.photo?.url || storagePhoto?.url || null,
      signatureUrl: latestByType.signature?.url || storageSignature?.url || null,
      photoFileName: latestByType.photo?.file_name || storagePhoto?.fileName || null,
      signatureFileName: latestByType.signature?.file_name || storageSignature?.fileName || null,
    });
  } catch (error) {
    return internalServerError(c, "Failed to load student profile assets", error);
  }
});

app.post("/submit-record", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const data = await c.req.json();
    const studentId = requester.profile.student_id || data.studentId;

    if (!studentId) {
      return badRequest('Student ID is required');
    }

    const studentPayload = {
      student_id: studentId,
      profile_id: requester.profile.id,
      first_name: data.firstName,
      last_name: data.lastName,
      middle_initial: data.middleInitial || null,
      department: data.department || null,
      course: data.course || null,
      age: data.age ? Number(data.age) : null,
      sex: data.sex || null,
      birthday: data.birthday || null,
      civil_status: data.civilStatus || null,
      contact_number: data.contactNumber || null,
      address: data.address || null,
    };

    const { error: studentError } = await supabase.from('students').upsert(studentPayload, {
      onConflict: 'student_id',
    });

    if (studentError) throw new Error(studentError.message);

    const { data: insertedSubmission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        student_id: studentId,
        year_level: Number(data.yearLevel),
        status: 'pending',
        first_name: data.firstName,
        last_name: data.lastName,
        middle_initial: data.middleInitial || null,
        department: data.department || null,
        course: data.course || null,
        age: data.age ? Number(data.age) : null,
        sex: data.sex || null,
        birthday: data.birthday || null,
        civil_status: data.civilStatus || null,
        contact_number: data.contactNumber || null,
        address: data.address || null,
        allergy_details: data.allergyDetails || null,
        had_operation: data.hadOperation || null,
        operation_details: data.operationDetails || null,
        weight: data.weight || null,
        height: data.height || null,
        bmi: data.bmi || null,
        data_privacy_consent: Boolean(data.dataPrivacyConsent),
      })
      .select('*')
      .single();

    if (submissionError || !insertedSubmission) {
      throw new Error(submissionError?.message || 'Failed to create submission');
    }

    const submissionId = insertedSubmission.id;

    await Promise.all([
      supabase.from('emergency_contacts').upsert({
        submission_id: submissionId,
        name: data.emergencyContact?.name || null,
        relationship: data.emergencyContact?.relationship || null,
        phone: data.emergencyContact?.phone || null,
        address: data.emergencyContact?.address || null,
      }),
      supabase.from('medical_history').upsert({
        submission_id: submissionId,
        allergy: Boolean(data.medicalHistory?.allergy),
        asthma: Boolean(data.medicalHistory?.asthma),
        chicken_pox: Boolean(data.medicalHistory?.chickenPox),
        diabetes: Boolean(data.medicalHistory?.diabetes),
        dysmenorrhea: Boolean(data.medicalHistory?.dysmenorrhea),
        epilepsy_seizure: Boolean(data.medicalHistory?.epilepsySeizure),
        heart_disorder: Boolean(data.medicalHistory?.heartDisorder),
        hepatitis: Boolean(data.medicalHistory?.hepatitis),
        hypertension: Boolean(data.medicalHistory?.hypertension),
        measles: Boolean(data.medicalHistory?.measles),
        mumps: Boolean(data.medicalHistory?.mumps),
        anxiety_disorder: Boolean(data.medicalHistory?.anxietyDisorder),
        panic_attack: Boolean(data.medicalHistory?.panicAttack),
        pneumonia: Boolean(data.medicalHistory?.pneumonia),
        ptb_primary_complex: Boolean(data.medicalHistory?.ptbPrimaryComplex),
        typhoid_fever: Boolean(data.medicalHistory?.typhoidFever),
        covid19: Boolean(data.medicalHistory?.covid19),
        uti: Boolean(data.medicalHistory?.uti),
      }),
    ]);

    invalidateDashboardReadCaches();
    return c.json({ success: true, recordId: submissionId });
  } catch (error) {
    console.log('Error submitting medical record:', error);
    return internalServerError(c, 'Failed to submit record', error);
  }
});

app.get("/student-records", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    if (!requester.profile.student_id && !isStaffRole(requester.profile.role)) {
      return badRequest('Student ID not found in profile');
    }

    const records = await getCachedStudentRecords(requester.profile.student_id);

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return internalServerError(c, 'Failed to fetch records', error);
  }
});

app.get("/student-records/:studentId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const studentId = c.req.param('studentId');
    const targetStudentId = isStaffRole(requester.profile.role) ? studentId : requester.profile.student_id;

    const records = await getCachedStudentRecords(targetStudentId);

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return internalServerError(c, 'Failed to fetch records', error);
  }
});

// Staff review routes.
app.get("/submissions", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const submissions = await getCachedSubmissionsList();
    return c.json({ submissions });
  } catch (error) {
    console.log('Error fetching submissions:', error);
    return internalServerError(c, 'Failed to fetch submissions', error);
  }
});

app.get("/staff/dashboard-overview", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    return c.json(await getCachedStaffDashboardOverview());
  } catch (error) {
    console.log('Error fetching staff dashboard overview:', error);
    return internalServerError(c, 'Failed to fetch staff dashboard overview', error);
  }
});

app.get("/reporting-term", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    return c.json(await getSafeAdminSystemSettings());
  } catch (error) {
    console.log('Error fetching reporting term settings:', error);
    return internalServerError(c, 'Failed to fetch reporting term settings', error);
  }
});

app.get("/session-policy", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const settings = await getSafeAdminSystemSettings();
    return c.json({
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    });
  } catch (error) {
    console.log('Error fetching session policy:', error);
    return internalServerError(c, 'Failed to fetch session policy', error);
  }
});

app.get("/staff/submission-summaries", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const searchQuery = String(c.req.query('search') || '').trim();
    const statusFilter = String(c.req.query('status') || 'action_needed').trim();
    const departmentFilter = String(c.req.query('department') || '').trim();
    const yearFilter = String(c.req.query('year') || '').trim();
    const sortOrder = String(c.req.query('sort') || 'desc').trim();
    const page = c.req.query('page');
    const pageSize = c.req.query('pageSize');

    return c.json(
      await getCachedStaffSubmissionSummaries({
        searchQuery,
        statusFilter,
        departmentFilter,
        yearFilter,
        sortOrder,
        page,
        pageSize,
      }),
    );
  } catch (error) {
    console.log('Error fetching staff submission summaries:', error);
    return internalServerError(c, 'Failed to fetch staff submission summaries', error);
  }
});

app.get("/staff/approved-students", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const searchQuery = String(c.req.query('search') || '').trim();
    const departmentFilter = String(c.req.query('department') || '').trim();
    const yearFilter = String(c.req.query('year') || '').trim();
    const courseFilter = String(c.req.query('course') || '').trim();
    const fromDate = String(c.req.query('fromDate') || '').trim();
    const toDate = String(c.req.query('toDate') || '').trim();
    const page = c.req.query('page');
    const pageSize = c.req.query('pageSize');

    return c.json(
      await getCachedApprovedStudents({
        searchQuery,
        departmentFilter,
        yearFilter,
        courseFilter,
        fromDate,
        toDate,
        page,
        pageSize,
      }),
    );
  } catch (error) {
    console.log('Error fetching approved student summaries:', error);
    return internalServerError(c, 'Failed to fetch approved student summaries', error);
  }
});

app.get("/submission/:id", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    const id = c.req.param('id');
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const [submission] = await getMappedSubmissions(
      supabase.from('submissions').select(SUBMISSION_LIST_COLUMNS).eq('id', id),
    );

    return c.json({ submission });
  } catch (error) {
    console.log('Error fetching submission:', error);
    return internalServerError(c, 'Failed to fetch submission', error);
  }
});

app.put("/submission/:id/status", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const { status, staffNotes } = await c.req.json();
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const now = new Date().toISOString();

    if (normalizedStatus === 'in_review') {
      const reviewerId = String(requester.staff?.id || '').trim();
      if (!reviewerId) {
        return badRequest('Staff account is not linked to this user.');
      }

      const { data: claimedRows, error: claimError } = await supabase
        .from('submissions')
        .update({
          status: normalizedStatus,
          staff_notes: staffNotes || null,
          reviewed_by: reviewerId,
          updated_at: now,
        })
        .eq('id', id)
        .in('status', ['pending', 'resubmitted'])
        .select('id');

      if (claimError) throw new Error(claimError.message);

      if ((claimedRows || []).length === 0) {
        const { data: currentSubmission, error: currentSubmissionError } = await supabase
          .from('submissions')
          .select('id,status,reviewed_by')
          .eq('id', id)
          .maybeSingle();

        if (currentSubmissionError) throw new Error(currentSubmissionError.message);
        if (!currentSubmission) {
          return c.json({ error: 'Submission not found.' }, 404);
        }

        if (currentSubmission.status === 'in_review' && currentSubmission.reviewed_by === reviewerId) {
          const { error: ownUpdateError } = await supabase
            .from('submissions')
            .update({
              staff_notes: staffNotes || null,
              updated_at: now,
            })
            .eq('id', id)
            .eq('reviewed_by', reviewerId);

          if (ownUpdateError) throw new Error(ownUpdateError.message);

          invalidateDashboardReadCaches();
          return c.json({ success: true });
        }

        if (currentSubmission.status === 'in_review' && currentSubmission.reviewed_by) {
          const reviewerDirectory = await loadStaffUsersByIds([currentSubmission.reviewed_by]);
          const reviewerName =
            formatStaffDisplayName(reviewerDirectory[currentSubmission.reviewed_by])
            || 'another clinic staff member';

          return c.json(
            {
              error: 'Submission already being reviewed.',
              details: `This submission is already being reviewed by ${reviewerName}.`,
              reviewedBy: currentSubmission.reviewed_by,
              reviewerName,
            },
            409,
          );
        }

        return c.json(
          {
            error: 'Submission is no longer available to claim.',
            details: 'This submission changed status. Refresh the review queue and try again.',
          },
          409,
        );
      }

      invalidateDashboardReadCaches();
      return c.json({ success: true });
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        status: normalizedStatus,
        staff_notes: staffNotes || null,
        reviewed_by: requester.staff?.id || null,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating submission status:', error);
    return internalServerError(c, 'Failed to update status', error);
  }
});

app.post("/notifications/status-email", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const { submissionId, status, staffNotes } = await c.req.json();
    if (!submissionId || !status) {
      return badRequest('submissionId and status are required');
    }

    const result = await sendStatusNotificationEmail(submissionId, status, staffNotes || null);
    return c.json(result);
  } catch (error) {
    console.log('Error sending status email notification:', error);
    return internalServerError(c, 'Failed to send status email notification', error);
  }
});

app.get("/student-notifications/state", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const requestedStudentId = String(c.req.query('studentId') || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const { data, error } = await supabase
      .from('kv_store_2a5e1a6b')
      .select('value')
      .eq('key', getStudentNotificationStateKey(requester, studentId))
      .maybeSingle();

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json({
          state: normalizeStudentNotificationState({}),
        });
      }
      throw new Error(error.message);
    }

    return c.json({
      state: normalizeStudentNotificationState(data?.value || {}),
    });
  } catch (error) {
    console.log('Error fetching student notification state:', error);
    return internalServerError(c, 'Failed to fetch notification state', error);
  }
});

app.put("/student-notifications/state", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'student') return forbidden();

  try {
    const payload = await c.req.json();
    const requestedStudentId = String(payload?.studentId || '').trim();
    const requesterStudentId = getRequesterStudentId(requester);
    const studentId = requestedStudentId || requesterStudentId;
    if (!studentId) return badRequest('studentId is required');
    if (studentId !== requesterStudentId) return forbidden();

    const state = normalizeStudentNotificationState(payload?.state || {});
    const { error } = await supabase
      .from('kv_store_2a5e1a6b')
      .upsert({
        key: getStudentNotificationStateKey(requester, studentId),
        value: state,
      });

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json({ success: true, persisted: false });
      }
      throw new Error(error.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error saving student notification state:', error);
    return internalServerError(c, 'Failed to save notification state', error);
  }
});

app.put("/submission/:id/measurements", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const measurements = await c.req.json();

    await Promise.all([
      supabase.from('staff_measurements').upsert({
        submission_id: id,
        blood_pressure: measurements.bloodPressure || null,
        cardiac_rate: measurements.cardiacRate || null,
        respiratory_rate: measurements.respiratoryRate || null,
        temperature: measurements.temperature || null,
        weight: measurements.weight || null,
        height: measurements.height || null,
        bmi: measurements.bmi || null,
        updated_by: requester.staff?.id || null,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('lab_chest_xray').upsert({
        submission_id: id,
        xray_date: measurements.xrayDate || null,
        xray_result: measurements.xrayResult || null,
        xray_findings: measurements.xrayFindings || null,
      }),
      supabase.from('lab_cbc').upsert({
        submission_id: id,
        hemoglobin: measurements.hemoglobin || null,
        hematocrit: measurements.hematocrit || null,
        wbc: measurements.wbc || null,
        platelet_count: measurements.plateletCount || null,
        blood_type: measurements.bloodType || null,
        glucose: measurements.glucose || null,
        protein: measurements.protein || null,
      }),
      supabase.from('lab_urinalysis').upsert({
        submission_id: id,
        glucose: measurements.urinalysisGlucose || null,
        protein: measurements.urinalysisProtein || null,
      }),
      supabase.from('submissions').update({
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    ]);

    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating measurements:', error);
    return internalServerError(c, 'Failed to update measurements', error);
  }
});

app.post("/upload-file", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;

  try {
    await ensureBucket();

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const recordId = formData.get('recordId') as string;
    const fileType = formData.get('fileType') as string;

    if (!file || !recordId || !fileType) {
      return badRequest('file, recordId, and fileType are required');
    }

    const access = await requireSubmissionAccess(requester, recordId);
    if (access.response) return access.response;

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${recordId}/${fileType}_${Date.now()}_${safeFileName}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, signedStorageUrlExpiresSeconds);

    if (signedUrlError) throw new Error(signedUrlError.message);

    const { data: insertedFile, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        submission_id: recordId,
        type: fileType,
        file_name: file.name,
        mime_type: file.type,
        url: null,
        storage_bucket: bucketName,
        storage_path: storagePath,
        uploaded_by: requester.profile.id,
      })
      .select('*')
      .single();

    if (fileInsertError || !insertedFile) {
      throw new Error(fileInsertError?.message || 'Failed to save file metadata');
    }

    if (fileType === 'xray') {
      await supabase.from('lab_chest_xray').upsert({ submission_id: recordId, file_id: insertedFile.id });
    }
    if (fileType === 'cbc') {
      await supabase.from('lab_cbc').upsert({ submission_id: recordId, file_id: insertedFile.id });
    }
    if (fileType === 'urinalysis') {
      await supabase.from('lab_urinalysis').upsert({ submission_id: recordId, file_id: insertedFile.id });
    }

    invalidateDashboardReadCaches();
    return c.json({
      success: true,
      url: signedUrlData?.signedUrl,
      fileName: storagePath,
    });
  } catch (error) {
    console.log('Error in file upload:', error);
    return internalServerError(c, 'Failed to upload file', error);
  }
});

app.get("/analytics", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const analytics = await getCachedAnalyticsSummary();
    return c.json(analytics);
  } catch (error) {
    console.log('Error fetching analytics:', error);
    return internalServerError(c, 'Failed to fetch analytics', error);
  }
});

// Administrator routes.
app.get("/staff-users", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const [{ data: staff, error }, archivedState] = await Promise.all([
      supabase
        .from('staff_users')
        .select('id,profile_id,first_name,last_name,name,position,is_active,email')
        .order('last_name', { ascending: true }),
      getArchivedUserIds(),
    ]);

    if (error) throw new Error(error.message);
    const archivedUserIds = archivedState.userIds;

    return c.json({
      staff: (staff || [])
        .filter((member) => !member.profile_id || !archivedUserIds.has(member.profile_id))
        .map((member) => ({
          id: member.id,
          userId: member.profile_id || member.id,
          name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name || 'Unnamed Staff',
          role: isDoctorPosition(member.position) ? 'Clinic Doctor' : (member.position || 'Clinic Staff'),
          position: member.position || 'Clinic Staff',
          status: member.is_active ? 'Active' : 'Inactive',
          email: member.email || '',
        })),
    });
  } catch (error) {
    console.log('Error fetching staff users:', error);
    return internalServerError(c, 'Failed to fetch staff users', error);
  }
});

app.get("/user-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const [
      { data: profiles, error: profilesError },
      { data: staffUsers, error: staffError },
      archivedState,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,student_id,first_name,last_name,email,role,created_at,updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('staff_users')
        .select('profile_id,first_name,last_name,email,is_active,position'),
      getArchivedUserIds(),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (staffError) throw new Error(staffError.message);

    const staffByProfileId = (staffUsers || []).reduce((acc, staff) => {
      if (staff.profile_id) acc[staff.profile_id] = staff;
      return acc;
    }, {} as Record<string, any>);
    const archivedUserIds = archivedState.userIds;

    return c.json({
      users: (profiles || [])
        .filter((profile) => !archivedUserIds.has(profile.id))
        .map((profile) => {
          const linkedStaff = staffByProfileId[profile.id];
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
            || profile.email
            || 'Unnamed User';

          return {
            userId: profile.id,
            id: profile.student_id || profile.id,
            name,
            email: profile.email || linkedStaff?.email || '',
            role: roleLabel(profile.role, linkedStaff?.position),
            roleKey: profile.role,
            position: linkedStaff?.position || null,
            status: linkedStaff?.is_active === false ? 'Inactive' : 'Active',
            lastActive: profile.updated_at || profile.created_at,
            canArchive: profile.role === 'student' || profile.role === 'staff',
          };
        }),
    });
  } catch (error) {
    console.log('Error fetching user accounts:', error);
    return internalServerError(c, 'Failed to fetch user accounts', error);
  }
});

app.get("/super-admin/administrators", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const [{ data: profiles, error }, archiveState] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,first_name,last_name,email,role,created_at,updated_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false }),
      getArchivedAccountsTableState(),
    ]);

    if (error) throw new Error(error.message);
    let archivedAdministrators: any[] = [];
    let archivedUserIds = new Set<string>();

    if (archiveState.available) {
      const { data: archivedAccounts, error: archivedError } = await supabase
        .from('archived_accounts')
        .select('id,user_id,account_identifier,display_name,email,archive_reason,archived_at')
        .eq('role', 'admin')
        .order('archived_at', { ascending: false });

      if (archivedError) throw new Error(archivedError.message);

      archivedAdministrators = (archivedAccounts || []).map((account) => ({
        archiveId: account.id,
        userId: account.user_id,
        id: account.account_identifier || account.user_id,
        name: account.display_name || account.email || 'Archived Administrator',
        email: account.email || '',
        role: 'Administrator',
        roleKey: 'admin',
        status: 'Archived',
        archivedAt: account.archived_at,
        archivedReason: account.archive_reason || '',
      }));
      archivedUserIds = new Set(
        (archivedAccounts || [])
          .map((account) => String(account.user_id || '').trim())
          .filter(Boolean),
      );
    }

    return c.json({
      administrators: (profiles || [])
        .filter((profile) => !archivedUserIds.has(profile.id))
        .map((profile) => {
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || profile.email
            || 'Unnamed Administrator';

          return {
            userId: profile.id,
            id: profile.id,
            name,
            email: profile.email || '',
            role: 'Administrator',
            roleKey: 'admin',
            status: 'Active',
            createdAt: profile.created_at,
            lastActive: profile.updated_at || profile.created_at,
          };
        }),
      archivedAdministrators,
    });
  } catch (error) {
    console.log('Error fetching administrators:', error);
    return internalServerError(c, 'Failed to fetch administrators', error);
  }
});

app.post("/super-admin/administrators", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const { email, password, firstName, lastName } = await c.req.json();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return badRequest('email and password are required');
    if (String(password).trim().length < minPasswordLength) return badRequest(passwordLengthError());

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create administrator');

    const userId = created.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'admin',
      email: normalizedEmail,
      first_name: firstName || null,
      last_name: lastName || null,
      student_id: null,
      department: null,
      course: null,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => null);
      throw new Error(profileError.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating administrator:', error);
    return internalServerError(c, 'Failed to create administrator', error);
  }
});

app.post("/super-admin/administrators/:userId/archive", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const userId = c.req.param('userId');
    if (!userId) return badRequest('userId is required');
    if (userId === requester.profile.id) return badRequest('You cannot archive your own super administrator account.');

    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    let reason: string | undefined;
    try {
      const body = await c.req.json();
      reason = body?.reason;
    } catch {
      reason = undefined;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,email,first_name,last_name,created_at,updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) return badRequest('Administrator account not found.');
    if (!isAdminRole(profile.role)) {
      return badRequest('Only administrator accounts can be archived here.');
    }

    await reassignAdministratorOwnedRows(userId, requester.profile.id);

    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
      || profile.email
      || 'Unnamed Administrator';

    const { error: archiveError } = await supabase
      .from('archived_accounts')
      .upsert({
        user_id: userId,
        role: profile.role,
        email: profile.email || null,
        display_name: displayName,
        account_identifier: profile.id,
        archived_by: requester.profile.id,
        archive_reason: reason?.trim() || null,
        snapshot: {
          profile: {
            role: profile.role,
            first_name: profile.first_name || null,
            last_name: profile.last_name || null,
            created_at: profile.created_at || null,
            updated_at: profile.updated_at || null,
          },
        },
        archived_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (archiveError) throw new Error(archiveError.message);

    await setArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();
    return c.json({ success: true });
  } catch (error) {
    console.log('Error archiving administrator:', error);
    return internalServerError(c, 'Failed to archive administrator', error);
  }
});

app.post("/super-admin/administrators/:archiveId/restore", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');

  try {
    const archiveId = c.req.param('archiveId');
    if (!archiveId) return badRequest('archiveId is required');

    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const { data: archivedAccount, error: archiveLookupError } = await supabase
      .from('archived_accounts')
      .select('*')
      .eq('id', archiveId)
      .maybeSingle();

    if (archiveLookupError) throw new Error(archiveLookupError.message);
    if (!archivedAccount) return badRequest('Archived administrator not found.');
    if (!isAdminRole(archivedAccount.role)) {
      return badRequest('Only archived administrator accounts can be restored here.');
    }

    const userId = archivedAccount.user_id;

    const { error: archiveDeleteError } = await supabase
      .from('archived_accounts')
      .delete()
      .eq('id', archiveId);

    if (archiveDeleteError) throw new Error(archiveDeleteError.message);

    await clearArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error restoring administrator:', error);
    return internalServerError(c, 'Failed to restore administrator', error);
  }
});

app.delete("/super-admin/administrators/:userId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isSuperAdminRole(requester.profile.role)) return forbidden('Only super administrators can manage administrator accounts.');
  return forbidden('Administrator accounts can no longer be deleted. Archive the account instead.');
});

app.get("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    return c.json(await getAdminSystemSettings());
  } catch (error) {
    console.log('Error fetching admin system settings:', error);
    return internalServerError(c, 'Failed to fetch admin system settings', error);
  }
});

app.put("/admin/system-settings", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const payload = await c.req.json();
    const settings = normalizeAdminSystemSettings(payload);

    const { error } = await supabase
      .from('kv_store_2a5e1a6b')
      .upsert({
        key: ADMIN_SYSTEM_SETTINGS_STORE_KEY,
        value: settings,
      });

    if (error) {
      if (isMissingKvStoreError(error)) {
        return c.json(settings);
      }
      throw new Error(error.message);
    }

    return c.json(settings);
  } catch (error) {
    console.log('Error saving admin system settings:', error);
    return internalServerError(c, 'Failed to save admin system settings', error);
  }
});

app.get("/archived-accounts", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role) && !isSuperAdminRole(requester.profile.role)) return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) {
      return c.json({ users: [] });
    }

    const { data: archivedAccounts, error } = await supabase
      .from('archived_accounts')
      .select('id,user_id,account_identifier,display_name,email,role,archived_at,archive_reason')
      .order('archived_at', { ascending: false });

    if (error) throw new Error(error.message);

    return c.json({
      users: (archivedAccounts || []).map((account) => ({
        archiveId: account.id,
        userId: account.user_id,
        id: account.account_identifier || account.user_id,
        name: account.display_name || account.email || 'Archived Account',
        email: account.email || '',
        role: roleLabel(account.role),
        roleKey: account.role,
        status: 'Archived',
        archivedAt: account.archived_at,
        archivedReason: account.archive_reason || '',
      })),
    });
  } catch (error) {
    console.log('Error fetching archived accounts:', error);
    return internalServerError(c, 'Failed to fetch archived accounts', error);
  }
});

app.post("/admin/archive-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role) && !isSuperAdminRole(requester.profile.role)) return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const { userId, reason } = await c.req.json();
    if (!userId) return badRequest('userId is required');
    if (userId === requester.profile.id) {
      return badRequest(
        isSuperAdminRole(requester.profile.role)
          ? 'You cannot archive your own super administrator account.'
          : 'You cannot archive your own administrator account.',
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) return badRequest('User account not found.');
    if (isSuperAdminRole(requester.profile.role)) {
      if (!isAdminRole(profile.role)) {
        return badRequest('Only administrator accounts can be archived here.');
      }
      await reassignAdministratorOwnedRows(userId, requester.profile.id);
    } else if (!['student', 'staff'].includes(profile.role)) {
      return badRequest('Only student and clinic staff accounts can be archived.');
    }

    const [{ data: linkedStaff }, { data: linkedStudent }, { data: submissions, error: submissionsError }] = await Promise.all([
      supabase.from('staff_users').select('*').eq('profile_id', userId).maybeSingle(),
      profile.student_id
        ? supabase.from('students').select('*').eq('student_id', profile.student_id).maybeSingle()
        : Promise.resolve({ data: null }),
      profile.student_id
        ? supabase.from('submissions').select('id,submitted_at').eq('student_id', profile.student_id)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (submissionsError) throw new Error(submissionsError.message);

    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
      || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
      || profile.email
      || 'Unnamed User';

    const archivePayload = {
      user_id: userId,
      role: profile.role,
      email: profile.email || linkedStaff?.email || null,
      display_name: displayName,
      account_identifier: profile.student_id || linkedStaff?.id || profile.id,
      archived_by: requester.profile.id,
      archive_reason: reason?.trim() || null,
      snapshot: {
        profile: {
          role: profile.role,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          department: profile.department || null,
          course: profile.course || null,
          student_id: profile.student_id || null,
        },
        student: linkedStudent
          ? {
              student_id: linkedStudent.student_id,
              department: linkedStudent.department || null,
              course: linkedStudent.course || null,
              year_level: linkedStudent.year_level || null,
            }
          : null,
        staff: linkedStaff
          ? {
              position: linkedStaff.position || null,
              is_active: linkedStaff.is_active ?? null,
            }
          : null,
        submissions: {
          count: submissions?.length || 0,
          last_submitted_at: (submissions || [])
            .map((entry) => entry.submitted_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null,
        },
      },
      archived_at: new Date().toISOString(),
    };

    const { error: archiveError } = await supabase
      .from('archived_accounts')
      .upsert(archivePayload, { onConflict: 'user_id' });

    if (archiveError) throw new Error(archiveError.message);

    if (linkedStaff?.profile_id) {
      const { error: staffUpdateError } = await supabase
        .from('staff_users')
        .update({ is_active: false })
        .eq('profile_id', linkedStaff.profile_id);

      if (staffUpdateError) throw new Error(staffUpdateError.message);
    }

    await setArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error archiving account:', error);
    return internalServerError(c, 'Failed to archive account', error);
  }
});

app.post("/admin/restore-account/:archiveId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role) && !isSuperAdminRole(requester.profile.role)) return forbidden();

  try {
    const archiveState = await getArchivedAccountsTableState();
    if (!archiveState.available) return archivedAccountsMigrationRequired();

    const archiveId = c.req.param('archiveId');
    if (!archiveId) return badRequest('archiveId is required');

    const { data: archivedAccount, error: archiveLookupError } = await supabase
      .from('archived_accounts')
      .select('*')
      .eq('id', archiveId)
      .maybeSingle();

    if (archiveLookupError) throw new Error(archiveLookupError.message);
    if (!archivedAccount) return badRequest('Archived account not found.');
    if (isSuperAdminRole(requester.profile.role)) {
      if (!isAdminRole(archivedAccount.role)) {
        return badRequest('Only archived administrator accounts can be restored here.');
      }
    } else if (isAdminRole(archivedAccount.role)) {
      return badRequest('Administrator accounts can only be restored by a super administrator.');
    }

    const userId = archivedAccount.user_id;

    const { error: archiveDeleteError } = await supabase.from('archived_accounts').delete().eq('id', archiveId);
    if (archiveDeleteError) throw new Error(archiveDeleteError.message);

    if (archivedAccount.role === 'staff') {
      const { error: staffUpdateError } = await supabase
        .from('staff_users')
        .update({ is_active: true })
        .eq('profile_id', userId);

      if (staffUpdateError) throw new Error(staffUpdateError.message);
    }

    await clearArchivedAuthState(userId);
    invalidateArchivedCaches();
    invalidateDashboardReadCaches();

    return c.json({ success: true });
  } catch (error) {
    console.log('Error restoring account:', error);
    return internalServerError(c, 'Failed to restore account', error);
  }
});

app.delete("/admin/archive-account/:archiveId", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  return forbidden('Permanent deletion of archived accounts is no longer available. Restore the account instead.');
});

app.post("/admin/create-account", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const { email, password, role = 'student', firstName, lastName, studentId, department, course } = await c.req.json();
    if (!email || !password) return badRequest('email and password are required');
    if (String(password).trim().length < minPasswordLength) return badRequest(passwordLengthError());
    if (!['student', 'staff'].includes(role)) {
      return badRequest('Only super administrators can create administrator accounts.');
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create user');

    const userId = created.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role,
      email: email.toLowerCase(),
      first_name: firstName || null,
      last_name: lastName || null,
      student_id: role === 'student' ? (studentId || null) : null,
      department: department || null,
      course: course || null,
      created_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    if (role === 'student' && studentId) {
      const { error: studentError } = await supabase.from('students').upsert({
        student_id: studentId,
        profile_id: userId,
        first_name: firstName || null,
        last_name: lastName || null,
        department: department || null,
        course: course || null,
      }, { onConflict: 'student_id' });
      if (studentError) throw new Error(studentError.message);
    }

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating account:', error);
    return internalServerError(c, 'Failed to create account', error);
  }
});

app.post("/admin/create-staff", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isAdminRole(requester.profile.role)) return forbidden();

  try {
    const { email, password, firstName, lastName, position = 'Clinic Staff' } = await c.req.json();
    if (!email || !password || !firstName || !lastName) return badRequest('email, password, firstName, and lastName are required');
    if (String(password).trim().length < minPasswordLength) return badRequest(passwordLengthError());
    if (!['Clinic Staff', 'Clinic Doctor'].includes(position)) return badRequest('position must be either Clinic Staff or Clinic Doctor');

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });
    if (createError || !created?.user) throw new Error(createError?.message || 'Failed to create user');

    const userId = created.user.id;
    const normalizedEmail = email.toLowerCase();

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'staff',
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      created_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    const { error: staffError } = await supabase.from('staff_users').upsert({
      profile_id: userId,
      email: normalizedEmail,
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      position,
      is_active: true,
    }, { onConflict: 'profile_id' });
    if (staffError) throw new Error(staffError.message);

    invalidateDashboardReadCaches();
    return c.json({ success: true, userId });
  } catch (error) {
    console.log('Error creating staff:', error);
    return internalServerError(c, 'Failed to create staff', error);
  }
});

app.post("/issue-certificate", async (c) => {
  const requester = await authenticate(c);
  const authError = requireActiveRequester(requester);
  if (authError) return authError;
  if (!isStaffRole(requester.profile.role)) return forbidden();
  if (!isDoctorOrAdmin(requester)) {
    return c.json({ error: 'Only Clinic Doctors can issue certificates.' }, 403);
  }

  try {
    const { submissionId, findingsNormal, diagnosis, remarks, purpose, controlNo, licenseNo } = await c.req.json();

    if (!submissionId) return badRequest('submissionId is required');

    const { error } = await supabase.from('certificates').upsert({
      submission_id: submissionId,
      findings_normal: findingsNormal ?? true,
      diagnosis: diagnosis || null,
      remarks: remarks || null,
      purpose: purpose || null,
      control_no: controlNo || null,
      license_no: licenseNo || null,
      issued_by: requester.staff?.id || null,
      issued_at: new Date().toISOString(),
    }, { onConflict: 'submission_id' });

    if (error) throw new Error(error.message);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error issuing certificate:', error);
    return internalServerError(c, 'Failed to issue certificate', error);
  }
});

Deno.serve(app.fetch);
