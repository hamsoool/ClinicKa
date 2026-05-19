const pendingStudentNotificationSaves = new Map<string, Set<Promise<void>>>();

function normalizeStudentId(studentId?: string | null) {
  return String(studentId || '').trim();
}

export function trackPendingStudentNotificationSave(studentId: string, promise: Promise<void>) {
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!normalizedStudentId) return promise;

  const pending = pendingStudentNotificationSaves.get(normalizedStudentId) || new Set<Promise<void>>();
  pending.add(promise);
  pendingStudentNotificationSaves.set(normalizedStudentId, pending);

  void promise.finally(() => {
    const currentPending = pendingStudentNotificationSaves.get(normalizedStudentId);
    if (!currentPending) return;

    currentPending.delete(promise);
    if (currentPending.size === 0) {
      pendingStudentNotificationSaves.delete(normalizedStudentId);
    }
  });

  return promise;
}

export async function flushPendingStudentNotificationSaves(studentId?: string | null) {
  const normalizedStudentId = normalizeStudentId(studentId);

  if (normalizedStudentId) {
    const pending = pendingStudentNotificationSaves.get(normalizedStudentId);
    if (!pending?.size) return;

    await Promise.allSettled([...pending]);
    return;
  }

  const allPending = [...pendingStudentNotificationSaves.values()].flatMap((entry) => [...entry]);
  if (!allPending.length) return;

  await Promise.allSettled(allPending);
}
