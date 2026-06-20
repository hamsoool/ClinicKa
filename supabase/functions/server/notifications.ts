// @ts-nocheck
import nodemailer from "npm:nodemailer";
import { normalizeEmail, supabase } from "./context.ts";
import { getSafeAdminSystemSettings } from "./settings.ts";

function getYearLevelLabel(yearLevel: unknown) {
  const value = Number(yearLevel);
  if (value === 1) return "Year I";
  if (value === 2) return "Year II";
  if (value === 3) return "Year III";
  if (value === 4) return "Year IV";
  return "your current school year";
}

function getSubmissionLabel(yearLevel: unknown, academicYear?: string | null) {
  const normalizedAcademicYear = String(academicYear || "").trim();
  if (normalizedAcademicYear) return `SY ${normalizedAcademicYear}`;
  return getYearLevelLabel(yearLevel);
}

function getStatusEmailContent(
  status: string,
  studentName: string,
  yearLabel: string,
  staffNotes?: string | null,
) {
  if (status === "returned") {
    return {
      subject: "Action Required: Medical Record Returned for Correction",
      text:
        `Hi ${studentName},\n\n` +
        `Your medical record submission for ${yearLabel} has been returned by the clinic staff for correction.\n\n` +
        `Note from Clinic Staff:\n"${staffNotes || "No specific notes provided."}"\n\n` +
        "Please log in to the student portal to update and resubmit your record.",
    };
  }

  if (status === "approved") {
    return {
      subject: "Medical Clearance Approved",
      text:
        `Hi ${studentName},\n\n` +
        `Good news! Your medical record submission for ${yearLabel} has been approved.\n\n` +
        "You can now view and download your medical clearance certificate from your dashboard in the clinic portal.",
    };
  }

  if (status === "physical_exam_done") {
    return {
      subject: "Physical Examination Completed",
      text:
        `Hi ${studentName},\n\n` +
        `Your physical examination for ${yearLabel} has been marked as completed by the clinic staff.\n\n` +
        "Your record is now in the final stage of review. We will notify you once your medical clearance is ready.",
    };
  }

  return null;
}

export async function sendStatusNotificationEmail(
  submissionId: string,
  status: string,
  staffNotes?: string | null,
) {
  const settings = await getSafeAdminSystemSettings();
  if (!settings.approvalEmailNotifications) {
    return { success: true, skipped: true, reason: "notifications_disabled" };
  }

  const smtpHost = String(Deno.env.get("SMTP_HOST") || "").trim();
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "0");
  const smtpUser = String(Deno.env.get("SMTP_USER") || "").trim();
  const smtpPass = String(Deno.env.get("SMTP_PASS") || "").trim();
  const smtpFromEmail = String(Deno.env.get("SMTP_FROM_EMAIL") || "").trim();
  const smtpFromName = String(Deno.env.get("SMTP_FROM_NAME") || "").trim() || "Gordon College Clinic";

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.",
    );
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("student_id, year_level, academic_year")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) throw new Error(submissionError.message);
  if (!submission?.student_id) throw new Error("Submission not found.");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("profile_id, first_name, last_name")
    .eq("student_id", submission.student_id)
    .maybeSingle();

  if (studentError) throw new Error(studentError.message);
  if (!student?.profile_id) {
    return { success: true, skipped: true, reason: "missing_student_profile" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", student.profile_id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const recipientEmail = normalizeEmail(profile?.email);
  if (!recipientEmail) {
    return { success: true, skipped: true, reason: "missing_recipient_email" };
  }

  const studentName =
    [student.first_name, student.last_name].filter(Boolean).join(" ").trim() ||
    "Student";
  const emailContent = getStatusEmailContent(
    status,
    studentName,
    getSubmissionLabel(submission.year_level, submission.academic_year),
    staffNotes,
  );

  if (!emailContent) {
    return { success: true, skipped: true, reason: "unsupported_status" };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"${smtpFromName}" <${smtpFromEmail || smtpUser}>`,
    to: recipientEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html:
      '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">' +
      '<h2 style="color: #006d3c;">Gordon College Clinic</h2>' +
      `<div style="line-height: 1.6; color: #333;">${emailContent.text.replace(/\n/g, "<br>")}</div>` +
      '<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">' +
      '<p style="font-size: 12px; color: #888;">This is an automated notification from the Gordon College Clinic System. Please do not reply to this email.</p>' +
      "</div>",
  });

  return { success: true };
}

export async function sendOtpEmail(recipientEmail: string, userName: string, otpCode: string) {
  const smtpHost = String(Deno.env.get("SMTP_HOST") || "").trim();
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "0");
  const smtpUser = String(Deno.env.get("SMTP_USER") || "").trim();
  const smtpPass = String(Deno.env.get("SMTP_PASS") || "").trim();
  const smtpFromEmail = String(Deno.env.get("SMTP_FROM_EMAIL") || "").trim();
  const smtpFromName = String(Deno.env.get("SMTP_FROM_NAME") || "").trim() || "Gordon College Clinic";

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const subject = "Verification Code for Changing Your Password";
  const text =
    `Hi ${userName},\n\n` +
    `You are receiving this email because a password change was requested for your account.\n\n` +
    `Your 2-Factor Authentication verification code is: ${otpCode}\n\n` +
    "This code will expire in 5 minutes.\n\n" +
    "If you did not request this change, please ignore this email and ensure your account is secure.";

  await transporter.sendMail({
    from: `"${smtpFromName}" <${smtpFromEmail || smtpUser}>`,
    to: recipientEmail,
    subject: subject,
    text: text,
    html:
      '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">' +
      '<h2 style="color: #006d3c;">Gordon College Clinic</h2>' +
      `<div style="line-height: 1.6; color: #333;">${text.replace(/\n/g, "<br>")}</div>` +
      '<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">' +
      '<p style="font-size: 12px; color: #888;">This is an automated notification from the Gordon College Clinic System. Please do not reply to this email.</p>' +
      "</div>",
  });
}

