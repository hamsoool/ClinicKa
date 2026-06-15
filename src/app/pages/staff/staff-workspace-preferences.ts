export type StaffDashboardQueueTab = 'all' | 'pending' | 'in_review' | 'returned' | 'resubmitted';
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
export type StaffAutoRefreshInterval = 'off' | '1m' | '5m' | '10m';

export type StaffWorkspacePreferences = {
  dashboardQueueTab: StaffDashboardQueueTab;
  reviewQueueStatus: StaffReviewQueueStatus;
  reviewSortOrder: StaffReviewSortOrder;
  showAdvancedQueueFilters: boolean;
  certificatesDefaultView: StaffCertificatesDefaultView;
  rememberLastCertificateStudent: boolean;
  defaultSignatoryName: string;
  defaultSignatoryTitle: string;
  autoRefreshInterval: StaffAutoRefreshInterval;
  enableSoundAlerts: boolean;
  defaultCannedResponse: string;
};

const STORAGE_KEY_PREFIX = 'gc-staff-workspace-preferences';

const DASHBOARD_QUEUE_TABS = new Set<StaffDashboardQueueTab>([
  'all',
  'pending',
  'in_review',
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
const AUTO_REFRESH_INTERVALS = new Set<StaffAutoRefreshInterval>(['off', '1m', '5m', '10m']);

function getStorageKey(staffId?: string | null) {
  return `${STORAGE_KEY_PREFIX}:${String(staffId || '').trim()}`;
}

function isClinicDoctor(position?: string | null) {
  return String(position || '').trim().toLowerCase() === 'clinic doctor';
}

export function getDefaultStaffWorkspacePreferences(position?: string | null): StaffWorkspacePreferences {
  const doctorDefaults = isClinicDoctor(position);
  const signatoryName = doctorDefaults ? 'Dr. Jane Doe, MD' : 'Nurse John Smith, RN';
  const signatoryTitle = doctorDefaults ? 'College Physician' : 'Clinic Nurse';

  return {
    dashboardQueueTab: 'pending',
    reviewQueueStatus: 'action_needed',
    reviewSortOrder: 'desc',
    showAdvancedQueueFilters: false,
    certificatesDefaultView: doctorDefaults ? 'medical-clearance' : 'form',
    rememberLastCertificateStudent: true,
    defaultSignatoryName: signatoryName,
    defaultSignatoryTitle: signatoryTitle,
    autoRefreshInterval: '5m',
    enableSoundAlerts: true,
    defaultCannedResponse: 'Please provide clear/high-resolution copies of your laboratory reports.',
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
    defaultSignatoryName:
      typeof value?.defaultSignatoryName === 'string'
        ? value.defaultSignatoryName
        : defaults.defaultSignatoryName,
    defaultSignatoryTitle:
      typeof value?.defaultSignatoryTitle === 'string'
        ? value.defaultSignatoryTitle
        : defaults.defaultSignatoryTitle,
    autoRefreshInterval: AUTO_REFRESH_INTERVALS.has(value?.autoRefreshInterval as StaffAutoRefreshInterval)
      ? (value?.autoRefreshInterval as StaffAutoRefreshInterval)
      : defaults.autoRefreshInterval,
    enableSoundAlerts:
      typeof value?.enableSoundAlerts === 'boolean'
        ? value.enableSoundAlerts
        : defaults.enableSoundAlerts,
    defaultCannedResponse:
      typeof value?.defaultCannedResponse === 'string'
        ? value.defaultCannedResponse
        : defaults.defaultCannedResponse,
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
