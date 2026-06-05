import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmissionRecord } from '../../lib/record-types';
import {
  clearStudentNotifications,
  deleteStudentNotification as deleteStudentNotificationRow,
  getStudentNotifications,
  markAllStudentNotificationsAsRead,
  syncStudentNotifications,
  updateStudentNotification,
  type StudentNotificationRecord,
  type StudentNotificationSyncInput,
} from '../../lib/api';
import { getRecordAcademicYear, getSubmissionSlotLabel, formatAcademicYearLabel } from '../../lib/academic-year';
import { useStudentRecordsQuery } from './student-records-query';

type NotifiableStatus = 'approved' | 'returned';

export type StudentNotificationItem = StudentNotificationRecord;

const MAX_NOTIFICATION_ITEMS = 20;

function studentNotificationsQueryKey(studentId?: string | null) {
  return ['studentNotifications', String(studentId || '').trim()] as const;
}

function getRecordTimestamp(record: SubmissionRecord) {
  return record.updatedAt || record.submittedAt || new Date().toISOString();
}

function getYearLabel(record: SubmissionRecord) {
  const academicYear = getRecordAcademicYear(record);
  if (academicYear) return formatAcademicYearLabel(academicYear);
  return getSubmissionSlotLabel(record.year);
}

function buildNotificationItem(record: SubmissionRecord): StudentNotificationSyncInput | null {
  const status = String(record.status || '').toLowerCase();
  if (status !== 'approved' && status !== 'returned') return null;

  const yearLabel = getYearLabel(record);
  const timestamp = getRecordTimestamp(record);
  const notificationKey = `${record.id}:${status}:${timestamp}`;

  if (status === 'approved') {
    return {
      notificationKey,
      submissionId: record.id,
      status: 'approved',
      title: 'Medical clearance approved',
      message: `Your ${yearLabel} medical clearance is approved and ready to view or download.`,
      actionLabel: 'Open clearance',
      actionPath: '/student/clearance',
      timestamp,
      yearLabel,
      read: false,
    };
  }

  return {
    notificationKey,
    submissionId: record.id,
    status: 'returned',
    title: 'Medical record returned',
    message: `Your ${yearLabel} medical record needs correction before it can be cleared.`,
    note: record.staffNotes || '',
    actionLabel: 'Review and resubmit',
    actionPath: `/student/privacy-waiver/${record.year || '1'}?edit=${encodeURIComponent(record.id)}`,
    timestamp,
    yearLabel,
    read: false,
  };
}

function sortByTimestamp<T extends { timestamp: string }>(items: T[]) {
  return [...items]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_NOTIFICATION_ITEMS);
}

export function useStudentNotifications(studentId?: string | null) {
  const normalizedStudentId = String(studentId || '').trim();
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { data: records = [] } = useStudentRecordsQuery(normalizedStudentId, 'summary');
  const queryKey = studentNotificationsQueryKey(normalizedStudentId);

  const notificationsQuery = useQuery({
    queryKey,
    enabled: Boolean(normalizedStudentId),
    queryFn: async () => {
      const response = await getStudentNotifications(normalizedStudentId);
      return sortByTimestamp(response.notifications || []);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const notifications = notificationsQuery.data || [];

  const derivedNotifications = useMemo(
    () => sortByTimestamp(records.map((record) => buildNotificationItem(record)).filter(Boolean) as StudentNotificationSyncInput[]),
    [records],
  );
  const derivedSnapshotKey = useMemo(
    () => derivedNotifications.map((item) => item.notificationKey).sort().join('|'),
    [derivedNotifications],
  );

  useEffect(() => {
    lastSyncedSnapshotRef.current = null;
  }, [normalizedStudentId]);

  const syncMutation = useMutation({
    mutationFn: (items: StudentNotificationSyncInput[]) => syncStudentNotifications(normalizedStudentId, items),
    onSuccess: (response) => {
      lastSyncedSnapshotRef.current = derivedSnapshotKey;
      queryClient.setQueryData(queryKey, sortByTimestamp(response.notifications || []));
    },
  });

  useEffect(() => {
    if (!normalizedStudentId || notificationsQuery.isLoading || notificationsQuery.isFetching || syncMutation.isPending) return;
    if (notificationsQuery.isError || derivedNotifications.length === 0) return;
    if (lastSyncedSnapshotRef.current === derivedSnapshotKey) return;

    syncMutation.mutate(derivedNotifications);
  }, [
    derivedNotifications,
    derivedSnapshotKey,
    normalizedStudentId,
    notificationsQuery.isError,
    notificationsQuery.isFetching,
    notificationsQuery.isLoading,
    syncMutation.isPending,
    syncMutation.mutate,
  ]);

  const updateNotificationMutation = useMutation({
    mutationFn: ({ notificationId, read }: { notificationId: string; read: boolean }) =>
      updateStudentNotification(notificationId, { read }),
    onMutate: async ({ notificationId, read }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<StudentNotificationItem[]>(queryKey) || [];
      queryClient.setQueryData<StudentNotificationItem[]>(
        queryKey,
        previousNotifications.map((item) => (item.id === notificationId ? { ...item, read } : item)),
      );
      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => markAllStudentNotificationsAsRead(normalizedStudentId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<StudentNotificationItem[]>(queryKey) || [];
      queryClient.setQueryData<StudentNotificationItem[]>(
        queryKey,
        previousNotifications.map((item) => (item.read ? item : { ...item, read: true })),
      );
      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => deleteStudentNotificationRow(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<StudentNotificationItem[]>(queryKey) || [];
      queryClient.setQueryData<StudentNotificationItem[]>(
        queryKey,
        previousNotifications.filter((item) => item.id !== notificationId),
      );
      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearNotificationsMutation = useMutation({
    mutationFn: () => clearStudentNotifications(normalizedStudentId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<StudentNotificationItem[]>(queryKey) || [];
      queryClient.setQueryData<StudentNotificationItem[]>(queryKey, []);
      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0),
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    markAllAsRead: () => {
      if (!normalizedStudentId || unreadCount === 0) return;
      markAllAsReadMutation.mutate();
    },
    markNotificationAsRead: (notificationId: string) => {
      const targetNotification = notifications.find((item) => item.id === notificationId);
      if (!normalizedStudentId || !targetNotification || targetNotification.read) return;
      updateNotificationMutation.mutate({ notificationId, read: true });
    },
    markNotificationAsUnread: (notificationId: string) => {
      const targetNotification = notifications.find((item) => item.id === notificationId);
      if (!normalizedStudentId || !targetNotification || !targetNotification.read) return;
      updateNotificationMutation.mutate({ notificationId, read: false });
    },
    deleteNotification: (notificationId: string) => {
      if (!normalizedStudentId) return;
      deleteNotificationMutation.mutate(notificationId);
    },
    clearNotifications: () => {
      if (!normalizedStudentId || notifications.length === 0) return;
      clearNotificationsMutation.mutate();
    },
  };
}
