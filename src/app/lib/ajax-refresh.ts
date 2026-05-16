export function getActiveAjaxRefetchInterval(intervalMs: number) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    return false;
  }

  if (document.visibilityState !== 'visible') {
    return false;
  }

  if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
    return false;
  }

  return intervalMs;
}
