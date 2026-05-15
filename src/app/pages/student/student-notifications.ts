import { useEffect, useMemo, useState } from 'react';
import type { MockSubmission } from '../../lib/mock-data';
import { useStudentRecordsQuery } from './student-records-query';

type NotifiableStatus = 'approved' | 'returned';

export type StudentNotificationItem = {
  id: string;
  submissionId: string;
  status: NotifiableStatus;
  title: string;
  message: string;
  note?: string;
  actionLabel: string;
  actionPath: string;
  timestamp: string;
  yearLabel: string;
  read: boolean;
};

type StoredNotificationItem = StudentNotificationItem;

type StoredNotificationState = {
  items: StoredNotificationItem[];
  snapshot: Record<string, string>;
};

const STORAGE_KEY_PREFIX = 'gc-student-notifications';
const MAX_NOTIFICATION_ITEMS = 20;
const YEAR_LABELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

function getStorageKey(studentId?: string | null) {
  return `${STORAGE_KEY_PREFIX}:${String(studentId || '').trim()}`;
}

function createEmptyState(): StoredNotificationState {
  return {
    items: [],
    snapshot: {},
  };
}

function loadStoredState(studentId?: string | null): StoredNotificationState {
  if (typeof window === 'undefined' || !studentId) return createEmptyState();

  try {
    const raw = window.localStorage.getItem(getStorageKey(studentId));
    if (!raw) return createEmptyState();

    const parsed = JSON.parse(raw) as Partial<StoredNotificationState> | null;
    return {
      items: Array.isArray(parsed?.items) ? parsed.items.filter(Boolean) as StoredNotificationItem[] : [],
      snapshot: parsed?.snapshot && typeof parsed.snapshot === 'object' ? parsed.snapshot as Record<string, string> : {},
    };
  } catch {
    return createEmptyState();
  }
}

function persistState(studentId: string, state: StoredNotificationState) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(getStorageKey(studentId), JSON.stringify(state));
}

function getRecordTimestamp(record: MockSubmission) {
  return record.updatedAt || record.submittedAt || new Date().toISOString();
}

function getYearLabel(year?: string) {
  const yearNumber = Number.parseInt(String(year || ''), 10);
  if (!Number.isFinite(yearNumber) || yearNumber < 1 || yearNumber > YEAR_LABELS.length) {
    return 'current year';
  }
  return YEAR_LABELS[yearNumber - 1];
}

function createSnapshotValue(record: MockSubmission) {
  return `${record.id}:${record.status}:${getRecordTimestamp(record)}`;
}

function buildNotificationItem(record: MockSubmission, isRead: boolean): StudentNotificationItem | null {
  const status = String(record.status || '').toLowerCase();
  if (status !== 'approved' && status !== 'returned') return null;

  const yearLabel = getYearLabel(record.year);
  const timestamp = getRecordTimestamp(record);

  if (status === 'approved') {
    return {
      id: `${record.id}:approved:${timestamp}`,
      submissionId: record.id,
      status: 'approved',
      title: 'Medical clearance approved',
      message: `Your ${yearLabel} medical clearance is approved and ready to view or download.`,
      actionLabel: 'Open clearance',
      actionPath: '/student/clearance',
      timestamp,
      yearLabel,
      read: isRead,
    };
  }

  return {
    id: `${record.id}:returned:${timestamp}`,
    submissionId: record.id,
    status: 'returned',
    title: 'Medical record returned',
    message: `Your ${yearLabel} medical record needs correction before it can be cleared.`,
    note: record.staffNotes || '',
    actionLabel: 'Review and resubmit',
    actionPath: `/student/privacy-waiver/${record.year || '1'}?edit=${encodeURIComponent(record.id)}`,
    timestamp,
    yearLabel,
    read: isRead,
  };
}

function sortNotifications(items: StoredNotificationItem[]) {
  return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function haveSnapshotsChanged(previous: Record<string, string>, next: Record<string, string>) {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return true;

  return nextKeys.some((key) => previous[key] !== next[key]);
}

export function useStudentNotifications(studentId?: string | null) {
  const normalizedStudentId = String(studentId || '').trim();
  const { data = [] } = useStudentRecordsQuery(normalizedStudentId);
  const records = data;
  const [state, setState] = useState<StoredNotificationState>(() => loadStoredState(normalizedStudentId));

  useEffect(() => {
    setState(loadStoredState(normalizedStudentId));
  }, [normalizedStudentId]);

  useEffect(() => {
    if (!normalizedStudentId) return;

    setState((previousState) => {
      const nextSnapshot: Record<string, string> = {};
      const knownNotificationIds = new Set(previousState.items.map((item) => item.id));
      const nextItems = [...previousState.items];
      let addedNotification = false;

      for (const record of records) {
        if (!record?.id) continue;

        const snapshotValue = createSnapshotValue(record);
        nextSnapshot[record.id] = snapshotValue;

        if (previousState.snapshot[record.id] === snapshotValue) continue;

        const nextNotification = buildNotificationItem(record, false);
        if (!nextNotification || knownNotificationIds.has(nextNotification.id)) continue;

        nextItems.unshift(nextNotification);
        knownNotificationIds.add(nextNotification.id);
        addedNotification = true;
      }

      const snapshotsChanged = haveSnapshotsChanged(previousState.snapshot, nextSnapshot);
      if (!addedNotification && !snapshotsChanged) {
        return previousState;
      }

      const mergedState = {
        items: sortNotifications(nextItems).slice(0, MAX_NOTIFICATION_ITEMS),
        snapshot: nextSnapshot,
      };
      persistState(normalizedStudentId, mergedState);
      return mergedState;
    });
  }, [records, normalizedStudentId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedStudentId) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getStorageKey(normalizedStudentId)) return;
      setState(loadStoredState(normalizedStudentId));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [normalizedStudentId]);

  const unreadCount = useMemo(
    () => state.items.reduce((count, item) => count + (item.read ? 0 : 1), 0),
    [state.items],
  );

  const markAllAsRead = () => {
    if (!normalizedStudentId) return;

    setState((previousState) => {
      if (!previousState.items.some((item) => !item.read)) return previousState;

      const nextState = {
        ...previousState,
        items: previousState.items.map((item) => (item.read ? item : { ...item, read: true })),
      };
      persistState(normalizedStudentId, nextState);
      return nextState;
    });
  };

  const markNotificationAsUnread = (notificationId: string) => {
    if (!normalizedStudentId) return;

    setState((previousState) => {
      const targetNotification = previousState.items.find((item) => item.id === notificationId);
      if (!targetNotification || !targetNotification.read) return previousState;

      const nextState = {
        ...previousState,
        items: previousState.items.map((item) => (
          item.id === notificationId ? { ...item, read: false } : item
        )),
      };
      persistState(normalizedStudentId, nextState);
      return nextState;
    });
  };

  const deleteNotification = (notificationId: string) => {
    if (!normalizedStudentId) return;

    setState((previousState) => {
      const nextItems = previousState.items.filter((item) => item.id !== notificationId);
      if (nextItems.length === previousState.items.length) return previousState;

      const nextState = {
        ...previousState,
        items: nextItems,
      };
      persistState(normalizedStudentId, nextState);
      return nextState;
    });
  };

  const clearNotifications = () => {
    if (!normalizedStudentId) return;

    setState((previousState) => {
      if (previousState.items.length === 0) return previousState;

      const nextState = {
        ...previousState,
        items: [],
      };
      persistState(normalizedStudentId, nextState);
      return nextState;
    });
  };

  return {
    notifications: state.items,
    unreadCount,
    markAllAsRead,
    markNotificationAsUnread,
    deleteNotification,
    clearNotifications,
  };
}
