type UploadActivityListener = () => void;

let activeUploadCount = 0;
const listeners = new Set<UploadActivityListener>();

function emitUploadActivityChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getActiveUploadCount() {
  return activeUploadCount;
}

export function subscribeToUploadActivity(listener: UploadActivityListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginTrackedUpload() {
  activeUploadCount += 1;
  emitUploadActivityChange();

  let finished = false;

  return () => {
    if (finished) return;
    finished = true;
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    emitUploadActivityChange();
  };
}
