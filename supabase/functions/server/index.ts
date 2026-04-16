// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '600',
};

app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.options('*', (c) => new Response(null, { status: 204, headers: corsHeaders }));

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, serviceRoleKey);
const bucketName = 'medical-files';

type Requester = {
  user: any;
  profile: any;
  student: any;
  staff: any;
};

const isStaffRole = (role?: string) => role === 'staff' || role === 'admin';

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function forbidden(message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((bucket) => bucket.name === bucketName);

  if (!exists) {
    await supabase.storage.createBucket(bucketName, { public: false });
  }
}

async function authenticate(c: any): Promise<Requester | null> {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return null;
  }

  const user = authData.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const [{ data: student }, { data: staff }] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .or(`profile_id.eq.${user.id},student_id.eq.${profile.student_id || '__none__'}`)
      .maybeSingle(),
    supabase
      .from('staff_users')
      .select('*')
      .or(`profile_id.eq.${user.id},email.eq.${user.email || '__none__'}`)
      .maybeSingle(),
  ]);

  return { user, profile, student, staff };
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
    if (!existing || new Date(file.uploaded_at).getTime() > new Date(existing.uploaded_at).getTime()) {
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
  const xray = related.xray[row.id];
  const cbc = related.cbc[row.id];
  const urinalysis = related.urinalysis[row.id];
  const certificate = related.certificates[row.id];
  const files = latestFilesByType(related.files[row.id] || []);

  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name || student.first_name || '',
    lastName: row.last_name || student.last_name || '',
    middleInitial: row.middle_initial || student.middle_initial || '',
    course: row.course || student.course || '',
    department: row.department || student.department || '',
    year: String(row.year_level || student.year_level || ''),
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    staffNotes: row.staff_notes,
    age: row.age ? String(row.age) : student.age ? String(student.age) : '',
    sex: row.sex || student.sex || '',
    birthday: row.birthday || student.birthday || '',
    civilStatus: row.civil_status || student.civil_status || '',
    contactNumber: row.contact_number || student.contact_number || '',
    address: row.address || student.address || '',
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
  };
}

async function loadRelatedData(rows: any[]) {
  const submissionIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];

  const [
    studentsRes,
    emergencyContactsRes,
    medicalHistoryRes,
    staffMeasurementsRes,
    xrayRes,
    cbcRes,
    urinalysisRes,
    certificatesRes,
    filesRes,
  ] = await Promise.all([
    studentIds.length
      ? supabase.from('students').select('*').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('emergency_contacts').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('medical_history').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('staff_measurements').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('lab_chest_xray').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('lab_cbc').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('lab_urinalysis').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('certificates').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
    submissionIds.length
      ? supabase.from('files').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byKey = (rowsData: any[] | null | undefined, key: string) =>
    (rowsData || []).reduce((acc, item) => {
      acc[item[key]] = item;
      return acc;
    }, {} as Record<string, any>);

  const filesBySubmission = (filesRes.data || []).reduce((acc, file) => {
    acc[file.submission_id] = acc[file.submission_id] || [];
    acc[file.submission_id].push(file);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    students: byKey(studentsRes.data, 'student_id'),
    emergencyContacts: byKey(emergencyContactsRes.data, 'submission_id'),
    medicalHistory: byKey(medicalHistoryRes.data, 'submission_id'),
    staffMeasurements: byKey(staffMeasurementsRes.data, 'submission_id'),
    xray: byKey(xrayRes.data, 'submission_id'),
    cbc: byKey(cbcRes.data, 'submission_id'),
    urinalysis: byKey(urinalysisRes.data, 'submission_id'),
    certificates: byKey(certificatesRes.data, 'submission_id'),
    files: filesBySubmission,
  };
}

async function getMappedSubmissions(queryBuilder: any) {
  const { data, error } = await queryBuilder.order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data || [];
  const related = await loadRelatedData(rows);
  return rows.map((row: any) => mapSubmission(row, related));
}

async function requireSubmissionAccess(requester: Requester, submissionId: string) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();

  if (error || !submission) {
    return { response: new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  if (!isStaffRole(requester.profile.role) && requester.profile.student_id !== submission.student_id) {
    return { response: forbidden() };
  }

  return { submission };
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/me", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();

  return c.json({
    profile: requester.profile,
    student: requester.student,
    staff: requester.staff,
  });
});

app.post("/submit-record", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
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
      year_level: data.yearLevel ? Number(data.yearLevel) : null,
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
        blood_pressure: data.bloodPressure || null,
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

    return c.json({ success: true, recordId: submissionId });
  } catch (error) {
    console.log('Error submitting medical record:', error);
    return c.json({ error: 'Failed to submit record', details: String(error) }, 500);
  }
});

app.get("/student-records", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();

  try {
    if (!requester.profile.student_id && !isStaffRole(requester.profile.role)) {
      return badRequest('Student ID not found in profile');
    }

    const records = await getMappedSubmissions(
      supabase.from('submissions').select('*').eq('student_id', requester.profile.student_id),
    );

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return c.json({ error: 'Failed to fetch records', details: String(error) }, 500);
  }
});

app.get("/student-records/:studentId", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();

  try {
    const studentId = c.req.param('studentId');
    const targetStudentId = isStaffRole(requester.profile.role) ? studentId : requester.profile.student_id;

    const records = await getMappedSubmissions(
      supabase.from('submissions').select('*').eq('student_id', targetStudentId),
    );

    return c.json({ records });
  } catch (error) {
    console.log('Error fetching student records:', error);
    return c.json({ error: 'Failed to fetch records', details: String(error) }, 500);
  }
});

app.get("/submissions", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const submissions = await getMappedSubmissions(supabase.from('submissions').select('*'));
    return c.json({ submissions });
  } catch (error) {
    console.log('Error fetching submissions:', error);
    return c.json({ error: 'Failed to fetch submissions', details: String(error) }, 500);
  }
});

app.get("/submission/:id", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();

  try {
    const id = c.req.param('id');
    const access = await requireSubmissionAccess(requester, id);
    if (access.response) return access.response;

    const [submission] = await getMappedSubmissions(
      supabase.from('submissions').select('*').eq('id', id),
    );

    return c.json({ submission });
  } catch (error) {
    console.log('Error fetching submission:', error);
    return c.json({ error: 'Failed to fetch submission', details: String(error) }, 500);
  }
});

app.put("/submission/:id/status", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const id = c.req.param('id');
    const { status, staffNotes } = await c.req.json();

    const { error } = await supabase
      .from('submissions')
      .update({
        status,
        staff_notes: staffNotes || null,
        reviewed_by: requester.staff?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating submission status:', error);
    return c.json({ error: 'Failed to update status', details: String(error) }, 500);
  }
});

app.put("/submission/:id/measurements", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
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

    return c.json({ success: true });
  } catch (error) {
    console.log('Error updating measurements:', error);
    return c.json({ error: 'Failed to update measurements', details: String(error) }, 500);
  }
});

app.post("/upload-file", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();

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
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedUrlError) throw new Error(signedUrlError.message);

    const { data: insertedFile, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        submission_id: recordId,
        type: fileType,
        file_name: file.name,
        mime_type: file.type,
        url: signedUrlData?.signedUrl,
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

    return c.json({
      success: true,
      url: signedUrlData?.signedUrl,
      fileName: storagePath,
    });
  } catch (error) {
    console.log('Error in file upload:', error);
    return c.json({ error: 'Failed to upload file', details: String(error) }, 500);
  }
});

app.get("/analytics", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { data: records, error } = await supabase.from('submissions').select('status');
    if (error) throw new Error(error.message);

    const pendingRecords = (records || []).filter((r) => r.status === 'pending').length;
    const approvedRecords = (records || []).filter((r) => r.status === 'approved').length;
    const returnedRecords = (records || []).filter((r) => r.status === 'returned').length;

    return c.json({
      totalStudents: totalStudents || 0,
      pendingRecords,
      approvedRecords,
      returnedRecords,
      totalSubmissions: records?.length || 0,
    });
  } catch (error) {
    console.log('Error fetching analytics:', error);
    return c.json({ error: 'Failed to fetch analytics', details: String(error) }, 500);
  }
});

app.get("/staff-users", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const { data: staff, error } = await supabase
      .from('staff_users')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) throw new Error(error.message);

    return c.json({
      staff: (staff || []).map((member) => ({
        id: member.staff_code || member.id,
        name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name || 'Unnamed Staff',
        role: member.position || 'Clinic Staff',
        status: member.is_active ? 'Active' : 'Inactive',
        email: member.email || '',
      })),
    });
  } catch (error) {
    console.log('Error fetching staff users:', error);
    return c.json({ error: 'Failed to fetch staff users', details: String(error) }, 500);
  }
});

app.get("/user-accounts", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
  if (requester.profile.role !== 'admin') return forbidden();

  try {
    const [{ data: profiles, error: profilesError }, { data: staffUsers, error: staffError }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('staff_users').select('*'),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (staffError) throw new Error(staffError.message);

    const staffByProfileId = (staffUsers || []).reduce((acc, staff) => {
      if (staff.profile_id) acc[staff.profile_id] = staff;
      return acc;
    }, {} as Record<string, any>);

    return c.json({
      users: (profiles || []).map((profile) => {
        const linkedStaff = staffByProfileId[profile.id];
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
          || [linkedStaff?.first_name, linkedStaff?.last_name].filter(Boolean).join(' ').trim()
          || profile.email
          || 'Unnamed User';

        return {
          id: profile.student_id || linkedStaff?.staff_code || profile.id,
          name,
          role:
            profile.role === 'admin'
              ? 'Administrator'
              : profile.role === 'staff'
                ? 'Clinic Staff'
                : 'Student',
          status: linkedStaff?.is_active === false ? 'Inactive' : 'Active',
          lastActive: profile.created_at,
        };
      }),
    });
  } catch (error) {
    console.log('Error fetching user accounts:', error);
    return c.json({ error: 'Failed to fetch user accounts', details: String(error) }, 500);
  }
});

app.post("/issue-certificate", async (c) => {
  const requester = await authenticate(c);
  if (!requester) return unauthorized();
  if (!isStaffRole(requester.profile.role)) return forbidden();

  try {
    const { submissionId, findingsNormal, diagnosis, remarks, purpose, controlNo } = await c.req.json();

    if (!submissionId) return badRequest('submissionId is required');

    const { error } = await supabase.from('certificates').upsert({
      submission_id: submissionId,
      findings_normal: findingsNormal ?? true,
      diagnosis: diagnosis || null,
      remarks: remarks || null,
      purpose: purpose || null,
      control_no: controlNo || null,
      issued_by: requester.staff?.id || null,
      issued_at: new Date().toISOString(),
    }, { onConflict: 'submission_id' });

    if (error) throw new Error(error.message);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error issuing certificate:', error);
    return c.json({ error: 'Failed to issue certificate', details: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
