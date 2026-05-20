export type StaffDashboardQueueTab = 'all' | 'pending' | 'returned' | 'resubmitted';
export type StaffReviewQueueStatus =
  | 'action_needed'
  | 'all'
  | 'pending'
  | 'physical_exam_done'
  | 'approved'
  | 'returned'
  | 'resubmitted';
export type StaffReviewSortOrder = 'desc' | 'asc';
export type StaffCertificatesDefaultView = 'form' | 'medical-clearance';

export type StaffWorkspacePreferences = {
  dashboardQueueTab: StaffDashboardQueueTab;
  reviewQueueStatus: StaffReviewQueueStatus;
  reviewSortOrder: StaffReviewSortOrder;
  showAdvancedQueueFilters: boolean;
  certificatesDefaultView: StaffCertificatesDefaultView;
  rememberLastCertificateStudent: boolean;
};

const STORAGE_KEY_PREFIX = 'gc-staff-workspace-preferences';

const DASHBOARD_QUEUE_TABS = new Set<StaffDashboardQueueTab>([
  'all',
  'pending',
  'returned',
  'resubmitted',
]);
const REVIEW_QUEUE_STATUSES = new Set<StaffReviewQueueStatus>([
  'action_needed',
  'all',
  'pending',
  'physical_exam_done',
  'approved',
  'returned',
  'resubmitted',
]);
const REVIEW_SORT_ORDERS = new Set<StaffReviewSortOrder>(['desc', 'asc']);
const CERTIFICATE_VIEWS = new Set<StaffCertificatesDefaultView>(['form', 'medical-clearance']);

function getStorageKey(staffId?: string | null) {
  return `${STORAGE_KEY_PREFIX}:${String(staffId || '').trim()}`;
}

function isClinicDoctor(position?: string | null) {
  return String(position || '').trim().toLowerCase() === 'clinic doctor';
}

export function getDefaultStaffWorkspacePreferences(position?: string | null): StaffWorkspacePreferences {
  const doctorDefaults = isClinicDoctor(position);

  return {
    dashboardQueueTab: doctorDefaults ? 'pending' : 'pending',
    reviewQueueStatus: doctorDefaults ? 'action_needed' : 'action_needed',
    reviewSortOrder: 'desc',
    showAdvancedQueueFilters: false,
    certificatesDefaultView: doctorDefaults ? 'medical-clearance' : 'form',
    rememberLastCertificateStudent: true,
  };
}

export function normalizeStaffWorkspacePreferences(
  value?: Partial<StaffWorkspacePreferences> | null,
  position?: string | null,
): StaffWorkspacePreferences {
  const defaults = getDefaultStaffWorkspacePreferences(position);

  return {
    dashboardQueueTab: DASHBOARD_QUEUE_TABS.has(value?.dashboardQueueTab as StaffDashboardQueueTab)
      ? (value?.dashboardQueueTab as StaffDashboardQueueTab)
      : defaults.dashboardQueueTab,
    reviewQueueStatus: REVIEW_QUEUE_STATUSES.has(value?.reviewQueueStatus as StaffReviewQueueStatus)
      ? (value?.reviewQueueStatus as StaffReviewQueueStatus)
      : defaults.reviewQueueStatus,
    reviewSortOrder: REVIEW_SORT_ORDERS.has(value?.reviewSortOrder as StaffReviewSortOrder)
      ? (value?.reviewSortOrder as StaffReviewSortOrder)
      : defaults.reviewSortOrder,
    showAdvancedQueueFilters:
      typeof value?.showAdvancedQueueFilters === 'boolean'
        ? value.showAdvancedQueueFilters
        : defaults.showAdvancedQueueFilters,
    certificatesDefaultView: CERTIFICATE_VIEWS.has(value?.certificatesDefaultView as StaffCertificatesDefaultView)
      ? (value?.certificatesDefaultView as StaffCertificatesDefaultView)
      : defaults.certificatesDefaultView,
    rememberLastCertificateStudent:
      typeof value?.rememberLastCertificateStudent === 'boolean'
        ? value.rememberLastCertificateStudent
        : defaults.rememberLastCertificateStudent,
  };
}

export function loadStaffWorkspacePreferences(
  staffId?: string | null,
  position?: string | null,
): StaffWorkspacePreferences {
  if (typeof window === 'undefined') {
    return getDefaultStaffWorkspacePreferences(position);
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(staffId));
    if (!raw) {
      return getDefaultStaffWorkspacePreferences(position);
    }

    return normalizeStaffWorkspacePreferences(
      JSON.parse(raw) as Partial<StaffWorkspacePreferences> | null,
      position,
    );
  } catch {
    return getDefaultStaffWorkspacePreferences(position);
  }
}

export function saveStaffWorkspacePreferences(
  staffId: string,
  preferences: StaffWorkspacePreferences,
  position?: string | null,
) {
  const normalized = normalizeStaffWorkspacePreferences(preferences, position);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getStorageKey(staffId), JSON.stringify(normalized));
  }

  return normalized;
}
