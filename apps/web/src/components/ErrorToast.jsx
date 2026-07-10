import { useSyncExternalStore } from 'react';
import { dismissError, getErrors, subscribe } from '../state/errorToastStore.js';

export default function ErrorToast() {
  const toasts = useSyncExternalStore(subscribe, getErrors, getErrors);
  if (toasts.length === 0) return null;
  return (
    <div
      className="error-toast-root"
      role="region"
      aria-label="Error notifications"
      aria-live="assertive"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="error-toast" role="alert" data-testid="error-toast">
          <span className="error-toast-message">{toast.message}</span>
          <button
            type="button"
            className="error-toast-dismiss"
            aria-label="Dismiss error"
            onClick={() => dismissError(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
