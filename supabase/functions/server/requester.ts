// @ts-nocheck
import {
  archivedAccountForbidden,
  isAdminRole,
  isDoctorPosition,
  isMissingRelationError,
  normalizeEmail,
  normalizeNamePart,
  supabase,
  unauthorized,
} from "./context.ts";
import type { Requester, TimedValue } from "./context.ts";

const ARCHIVE_TABLE_STATE_TTL_MS = 60_000;
const ARCHIVED_USER_IDS_TTL_MS = 30_000;

let archivedTableStateCache: TimedValue<{ available: boolean; rows: any[] }> | null = null;
let archivedTableStatePromise: Promise<{ available: boolean; rows: any[] }> | null = null;
let archivedUserIdsCache:
  | TimedValue<{ available: boolean; userIds: Set<string> }>
  | null = null;

const SUPER_ADMIN_EMAILS = new Set(
  String(Deno.env.get("SUPER_ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean),
);

export function isConfiguredSuperAdminEmail(email?: string | null) {
  return SUPER_ADMIN_EMAILS.has(normalizeEmail(email));
}

function withRuntimeRoleOverrides(profile: any, user: any) {
  if (!profile) return profile;
  if (!isConfiguredSuperAdminEmail(user?.email)) return profile;

  return profile.role === "super_admin" ? profile : { ...profile, role: "super_admin" };
}

function splitFullNameParts(fullName?: string | null) {
  const parts = String(fullName || "").split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0] || null, lastName: null };
  }
  return {
    firstName: parts.slice(0, -1).join(" ").trim() || null,
    lastName: parts.slice(-1).join(" ").trim() || null,
  };
}

function nameTokensMatchSuffix(value: string, suffix: string) {
  const valueParts = String(value || "").split(/\s+/).filter(Boolean);
  const suffixParts = String(suffix || "").split(/\s+/).filter(Boolean);
  if (!valueParts.length || !suffixParts.length || suffixParts.length >= valueParts.length) {
    return false;
  }
  return suffixParts.every((part, index) =>
    valueParts[valueParts.length - suffixParts.length + index]?.toLowerCase() === part.toLowerCase()
  );
}

function isGoogleAuthUser(user: any) {
  const providers = [
    user?.app_metadata?.provider,
    ...(Array.isArray(user?.identities)
      ? user.identities.map((identity: any) => identity?.provider)
      : []),
  ];
  return providers.some(
    (provider) => String(provider || "").trim().toLowerCase() === "google",
  );
}

function deriveNamePartsFromUser(user: any) {
  const isGoogleUser = isGoogleAuthUser(user);
  const googleIdentityData =
    (Array.isArray(user?.identities)
      ? user.identities.find((identity: any) =>
          String(identity?.provider || "").trim().toLowerCase() === "google"
        )?.identity_data
      : null) || null;
  const identityFirstName = normalizeNamePart(
    googleIdentityData?.given_name
    || googleIdentityData?.first_name,
  );
  const identityLastName = normalizeNamePart(
    googleIdentityData?.family_name
    || googleIdentityData?.last_name,
  );

  const fullName = normalizeNamePart(
    user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || googleIdentityData?.full_name
    || googleIdentityData?.name,
  );
  if (isGoogleUser && fullName) {
    if (identityLastName && nameTokensMatchSuffix(fullName, identityLastName)) {
      const fullNameParts = fullName.split(/\s+/).filter(Boolean);
      const lastNameParts = identityLastName.split(/\s+/).filter(Boolean);
      return {
        firstName: fullNameParts.slice(0, fullNameParts.length - lastNameParts.length).join(" ").trim() || identityFirstName,
        lastName: identityLastName,
      };
    }
    if (identityFirstName && identityLastName) {
      return { firstName: identityFirstName, lastName: identityLastName };
    }
    return splitFullNameParts(fullName);
  }

  const firstName = normalizeNamePart(
    user?.user_metadata?.first_name
    || user?.user_metadata?.given_name,
  );
  const lastName = normalizeNamePart(
    user?.user_metadata?.last_name
    || user?.user_metadata?.family_name,
  );

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  if (!fullName) {
    return { firstName: null, lastName: null };
  }

  const splitNames = splitFullNameParts(fullName);
  return {
    firstName: splitNames.firstName || firstName,
    lastName: splitNames.lastName || lastName,
  };
}

export function formatStaffDisplayName(staff?: any) {
  const fullName = [normalizeNamePart(staff?.first_name), normalizeNamePart(staff?.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;

  return normalizeNamePart(staff?.name);
}

export async function loadStaffUsersByIds(staffIds: string[]) {
  const uniqueStaffIds = [
    ...new Set((staffIds || []).map((value) => String(value || "").trim()).filter(Boolean)),
  ];
  if (!uniqueStaffIds.length) {
    return {} as Record<string, any>;
  }

  const { data, error } = await supabase
    .from("staff_users")
    .select("id,profile_id,first_name,last_name,middle_initial,position,name")
    .in("id", uniqueStaffIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).reduce((acc, staff) => {
    acc[staff.id] = staff;
    return acc;
  }, {} as Record<string, any>);
}

function isGCDomainEmail(email?: string | null) {
  return normalizeEmail(email).endsWith("@gordoncollege.edu.ph");
}

function isValidStudentProvisionEmail(email?: string | null) {
  return Boolean(isGCDomainEmail(email) && deriveStudentIdFromEmail(email));
}

export function deriveStudentIdFromEmail(email?: string | null) {
  const localPart = normalizeEmail(email).split("@")[0] || "";
  const match = localPart.match(/^(\d{9})/);
  return match?.[1] || null;
}

export function isRejectedGoogleUser(user: any) {
  return isGoogleAuthUser(user) && !isGCDomainEmail(user?.email);
}

export async function purgeRejectedGoogleUser(user: any) {
  const userId = String(user?.id || "").trim();
  if (!userId) return;

  const derivedStudentId = deriveStudentIdFromEmail(user?.email);

  await Promise.allSettled([
    supabase.from("staff_users").delete().eq("profile_id", userId),
    supabase.from("profiles").delete().eq("id", userId),
    derivedStudentId
      ? supabase
          .from("students")
          .delete()
          .or(`profile_id.eq.${userId},student_id.eq.${derivedStudentId}`)
      : supabase.from("students").delete().eq("profile_id", userId),
  ]);

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    throw authDeleteError;
  }
}

export function roleLabel(role?: string, position?: string | null) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Administrator";
  if (role === "staff") {
    if (isDoctorPosition(position)) return "Clinic Doctor";
    return "Clinic Staff";
  }
  return "Student";
}

export function requireActiveRequester(requester: Requester | null) {
  if (!requester) return unauthorized();
  if (requester.archivedAccount) return archivedAccountForbidden();
  return null;
}

function isMissingArchivedAccountsTableError(error: any) {
  const message = String(error?.message || error?.details || error || "");
  return message.includes("Could not find the table 'public.archived_accounts'");
}

export async function getArchivedAccountsTableState() {
  const now = Date.now();
  if (archivedTableStateCache && archivedTableStateCache.expiresAt > now) {
    return archivedTableStateCache.value;
  }
  if (archivedTableStatePromise) {
    return archivedTableStatePromise;
  }

  archivedTableStatePromise = (async () => {
    const { data, error } = await supabase.from("archived_accounts").select("id").limit(1);

    let value: { available: boolean; rows: any[] };
    if (error) {
      if (isMissingArchivedAccountsTableError(error)) {
        value = { available: false, rows: [] };
      } else {
        throw new Error(error.message);
      }
    } else {
      value = { available: true, rows: data || [] };
    }

    archivedTableStateCache = {
      value,
      expiresAt: Date.now() + ARCHIVE_TABLE_STATE_TTL_MS,
    };
    return value;
  })();

  try {
    return await archivedTableStatePromise;
  } finally {
    archivedTableStatePromise = null;
  }
}

export async function getArchivedUserIds() {
  const now = Date.now();
  if (archivedUserIdsCache && archivedUserIdsCache.expiresAt > now) {
    return {
      available: archivedUserIdsCache.value.available,
      userIds: new Set(archivedUserIdsCache.value.userIds),
    };
  }

  const state = await getArchivedAccountsTableState();
  if (!state.available) {
    const value = {
      available: false,
      userIds: new Set<string>(),
    };
    archivedUserIdsCache = {
      value,
      expiresAt: Date.now() + ARCHIVED_USER_IDS_TTL_MS,
    };
    return value;
  }

  const { data, error } = await supabase.from("archived_accounts").select("user_id");
  if (error) {
    if (isMissingArchivedAccountsTableError(error)) {
      const value = {
        available: false,
        userIds: new Set<string>(),
      };
      archivedUserIdsCache = {
        value,
        expiresAt: Date.now() + ARCHIVED_USER_IDS_TTL_MS,
      };
      return value;
    }

    throw new Error(error.message);
  }

  const value = {
    available: true,
    userIds: new Set((data || []).map((row) => row.user_id).filter(Boolean)),
  };
  archivedUserIdsCache = {
    value,
    expiresAt: Date.now() + ARCHIVED_USER_IDS_TTL_MS,
  };
  return {
    available: value.available,
    userIds: new Set(value.userIds),
  };
}

export function archivedAccountsMigrationRequired() {
  return new Response(
    JSON.stringify({
      error: "Archived accounts schema changes are not applied in the target Supabase project.",
    }),
    {
      status: 409,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function invalidateArchivedCaches() {
  archivedTableStateCache = null;
  archivedUserIdsCache = null;
}

async function ensureProfile(user: any) {
  const derivedStudentId = deriveStudentIdFromEmail(user.email);
  const normalizedUserEmail = normalizeEmail(user.email) || null;
  const canSelfProvisionStudent = isValidStudentProvisionEmail(user.email);
  const isGoogleUser = isGoogleAuthUser(user);
  const { firstName, lastName } = deriveNamePartsFromUser(user);
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    if (
      existingProfile.role === "student" &&
      canSelfProvisionStudent &&
      (existingProfile.student_id !== derivedStudentId ||
        existingProfile.email !== normalizedUserEmail ||
        (firstName && !existingProfile.first_name) ||
        (lastName && !existingProfile.last_name) ||
        (isGoogleUser &&
          ((firstName && normalizeNamePart(existingProfile.first_name) !== firstName) ||
            (lastName && normalizeNamePart(existingProfile.last_name) !== lastName))))
    ) {
      const { data: updatedProfile, error: updatedProfileError } = await supabase
        .from("profiles")
        .update({
          email: normalizedUserEmail,
          student_id: derivedStudentId,
          first_name: isGoogleUser
            ? (firstName || existingProfile.first_name || null)
            : (existingProfile.first_name || firstName || null),
          last_name: isGoogleUser
            ? (lastName || existingProfile.last_name || null)
            : (existingProfile.last_name || lastName || null),
        })
        .eq("id", user.id)
        .select("*")
        .single();

      if (updatedProfileError) {
        throw updatedProfileError;
      }

      return updatedProfile;
    }

    return existingProfile;
  }

  const roleForNewProfile = canSelfProvisionStudent
    ? "student"
    : isConfiguredSuperAdminEmail(user?.email)
      ? "admin"
      : null;

  if (!roleForNewProfile) {
    throw new Error("Profile not found for authenticated user.");
  }

  const { data: createdProfile, error: createdProfileError } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      role: roleForNewProfile,
      email: normalizedUserEmail,
      student_id: canSelfProvisionStudent ? derivedStudentId : null,
      first_name: firstName,
      last_name: lastName,
    })
    .select("*")
    .single();

  if (createdProfileError) {
    throw createdProfileError;
  }

  return createdProfile;
}

async function syncGoogleStudentNames(user: any, profile: any) {
  if (!profile || profile.role !== "student" || !isGoogleAuthUser(user)) {
    return;
  }

  const { firstName, lastName } = deriveNamePartsFromUser(user);
  if (!firstName && !lastName) {
    return;
  }

  const derivedStudentId = deriveStudentIdFromEmail(user.email);
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("student_id,profile_id,first_name,last_name")
    .or(`profile_id.eq.${user.id},student_id.eq.${profile.student_id || derivedStudentId || "__none__"}`)
    .maybeSingle();

  if (studentError || !student) {
    return;
  }

  const shouldUpdate =
    (firstName && normalizeNamePart(student.first_name) !== firstName) ||
    (lastName && normalizeNamePart(student.last_name) !== lastName) ||
    (!student.profile_id && student.student_id === (profile.student_id || derivedStudentId));

  if (!shouldUpdate) {
    return;
  }

  await supabase
    .from("students")
    .update({
      profile_id: student.profile_id || user.id,
      first_name: firstName || student.first_name || null,
      last_name: lastName || student.last_name || null,
    })
    .eq("student_id", student.student_id);
}

export async function setArchivedAuthState(userId: string) {
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  } as any);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearArchivedAuthState(userId: string) {
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  } as any);

  if (error) {
    throw new Error(error.message);
  }
}

export async function reassignAdministratorOwnedRows(
  userId: string,
  replacementUserId: string,
) {
  const { error } = await supabase
    .from("announcements")
    .update({ created_by: replacementUserId })
    .eq("created_by", userId);

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function authenticate(c: any): Promise<Requester | null> {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return null;
  }

  const user = authData.user;

  if (isRejectedGoogleUser(user)) {
    try {
      await purgeRejectedGoogleUser(user);
    } catch (error) {
      console.log("Failed to purge rejected Google user during authentication:", error);
    }
    return null;
  }

  let archivedAccount = null;
  const { data, error: archivedError } = await supabase
    .from("archived_accounts")
    .select(
      "id,user_id,role,email,display_name,account_identifier,archive_reason,archived_at,snapshot",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (archivedError) {
    if (!isMissingArchivedAccountsTableError(archivedError)) {
      return null;
    }
  } else {
    archivedAccount = data || null;
  }

  if (archivedAccount) {
    return {
      user,
      profile: null,
      student: null,
      staff: null,
      archivedAccount,
    };
  }

  let profile = null;
  try {
    profile = await ensureProfile(user);
    await syncGoogleStudentNames(user, profile);
  } catch {
    return null;
  }

  const [{ data: student }, { data: staff }] = await Promise.all([
    supabase
      .from("students")
      .select(
        "student_id,profile_id,first_name,last_name,middle_initial,department,course,year_level,age,sex,birthday,civil_status,contact_number,address",
      )
      .or(`profile_id.eq.${user.id},student_id.eq.${profile.student_id || "__none__"}`)
      .maybeSingle(),
    supabase
      .from("staff_users")
      .select("id,profile_id,email,first_name,last_name,middle_initial,position,phone,is_active")
      .or(`profile_id.eq.${user.id},email.eq.${user.email || "__none__"}`)
      .maybeSingle(),
  ]);

  return {
    user,
    profile: withRuntimeRoleOverrides(profile, user),
    student,
    staff,
    archivedAccount: null,
  };
}
