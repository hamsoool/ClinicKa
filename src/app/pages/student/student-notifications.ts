import { useEffect, useMemo, useState } from 'react';
import type { SubmissionRecord } from '../../lib/record-types';
import {
  getStudentNotificationState,
  saveStudentNotificationState,
  type StudentNotificationStatePayload,
} from '../../lib/api';
import { trackPendingStudentNotificationSave } from '../../lib/student-notification-save-queue';
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

function normalizeStoredState(value?: Partial<StudentNotificationStatePayload> | null): StoredNotificationState {
  const rawItems = Array.isArray(value?.items) ? value.items : [];
  const items = rawItems
    .filter((item): item is StoredNotificationItem => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<StudentNotificationItem>;
      return typeof candidate.id === 'string' && typeof candidate.submissionId === 'string';
    })
    .slice(0, MAX_NOTIFICATION_ITEMS);
  const snapshot =
    value?.snapshot && typeof value.snapshot === 'object' && !Array.isArray(value.snapshot)
      ? Object.fromEntries(
          Object.entries(value.snapshot)
            .filter(([key, entryValue]) => key && typeof entryValue === 'string'),
        )
      : {};

  return {
    items: sortNotifications(items),
    snapshot,
  };
}

function loadStoredState(studentId?: string | null): StoredNotificationState {
  if (typeof window === 'undefined' || !studentId) return createEmptyState();

  try {
    const raw = window.localStorage.getItem(getStorageKey(studentId));
    if (!raw) return createEmptyState();

    return normalizeStoredState(JSON.parse(raw) as Partial<StoredNotificationState> | null);
  } catch {
    return createEmptyState();
  }
}

function persistLocalState(studentId: string, state: StoredNotificationState) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(getStorageKey(studentId), JSON.stringify(state));
}

function persistState(studentId: string, state: StoredNotificationState) {
  persistLocalState(studentId, state);
  const savePromise = saveStudentNotificationState(studentId, state)
    .then(() => undefined)
    .catch((error) => {
      console.warn('Failed to persist student notification state:', error);
    });
  trackPendingStudentNotificationSave(studentId, savePromise);
  return savePromise;
}

function getRecordTimestamp(record: SubmissionRecord) {
  return record.updatedAt || record.submittedAt || new Date().toISOString();
}

function getYearLabel(year?: string) {
  const yearNumber = Number.parseInt(String(year || ''), 10);
  if (!Number.isFinite(yearNumber) || yearNumber < 1 || yearNumber > YEAR_LABELS.length) {
    return 'current year';
  }
  return YEAR_LABELS[yearNumber - 1];
}

function createSnapshotValue(record: SubmissionRecord) {
  return `${record.id}:${record.status}:${getRecordTimestamp(record)}`;
}

function buildNotificationItem(record: SubmissionRecord, isRead: boolean): StudentNotificationItem | null {
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

function normalizeStateForComparison(state: StoredNotificationState): StoredNotificationState {
  return {
    items: sortNotifications(state.items).slice(0, MAX_NOTIFICATION_ITEMS),
    snapshot: Object.fromEntries(
      Object.entries(state.snapshot || {})
        .filter(([key, value]) => key && typeof value === 'string')
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)),
    ),
  };
}

function mergeStoredStates(localState: StoredNotificationState, remoteState: StoredNotificationState) {
  const itemsById = new Map<string, StoredNotificationItem>();
  for (const item of remoteState.items) {
    const localItem = localState.items.find((candidate) => candidate.id === item.id);
    itemsById.set(item.id, localItem ? { ...item, ...localItem, read: Boolean(item.read || localItem.read) } : item);
  }
  for (const item of localState.items) {
    if (!itemsById.has(item.id)) {
      itemsById.set(item.id, item);
    }
  }

  return {
    items: sortNotifications([...itemsById.values()]).slice(0, MAX_NOTIFICATION_ITEMS),
    snapshot: {
      ...localState.snapshot,
      ...remoteState.snapshot,
    },
  };
}

function areStoredStatesEqual(left: StoredNotificationState, right: StoredNotificationState) {
  return JSON.stringify(normalizeStateForComparison(left)) === JSON.stringify(normalizeStateForComparison(right));
}

function haveSnapshotsChanged(previous: Record<string, string>, next: Record<string, string>) {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return true;

  return nextKeys.some((key) => previous[key] !== next[key]);
}

export function useStudentNotifications(studentId?: string | null) {
  const normalizedStudentId = String(studentId || '').trim();
  const { data = [] } = useStudentRecordsQuery(normalizedStudentId, 'summary');
  const records = data;
  const [state, setState] = useState<StoredNotificationState>(() => loadStoredState(normalizedStudentId));
  const [notificationStateLoaded, setNotificationStateLoaded] = useState(() => !normalizedStudentId);

  useEffect(() => {
    const localState = loadStoredState(normalizedStudentId);
    setState(localState);

    if (!normalizedStudentId) {
      setNotificationStateLoaded(true);
      return;
    }

    let cancelled = false;
    setNotificationStateLoaded(false);
    void getStudentNotificationState(normalizedStudentId)
      .then((response) => {
        if (cancelled || !response?.state) return;

        const remoteState = normalizeStoredState(response.state);
        setState((previousState) => {
          const mergedState = mergeStoredStates(previousState, remoteState);
          persistLocalState(normalizedStudentId, mergedState);
          if (!areStoredStatesEqual(remoteState, mergedState)) {
            void persistState(normalizedStudentId, mergedState);
          }
          return mergedState;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setNotificationStateLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedStudentId]);

  useEffect(() => {
    if (!normalizedStudentId || !notificationStateLoaded) return;

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
  }, [notificationStateLoaded, records, normalizedStudentId]);

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

  const markNotificationAsRead = (notificationId: string) => {
    if (!normalizedStudentId) return;

    setState((previousState) => {
      const targetNotification = previousState.items.find((item) => item.id === notificationId);
      if (!targetNotification || targetNotification.read) return previousState;

      const nextState = {
        ...previousState,
        items: previousState.items.map((item) => (
          item.id === notificationId ? { ...item, read: true } : item
        )),
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
    markNotificationAsRead,
    markNotificationAsUnread,
    deleteNotification,
    clearNotifications,
  };
}
