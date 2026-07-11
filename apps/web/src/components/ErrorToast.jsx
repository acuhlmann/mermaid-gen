import { useSyncExternalStore } from 'react';
import { dismissError, getErrors, subscribe } from '../state/errorToastStore.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

export default function ErrorToast() {
  const { controls } = useUiCopy();
  const toasts = useSyncExternalStore(subscribe, getErrors, getErrors);
  if (toasts.length === 0) return null;
  return (
    <div
      className="error-toast-root"
      role="region"
      aria-label={controls.errors.notifications}
      aria-live="assertive"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="error-toast" role="alert" data-testid="error-toast">
          <span className="error-toast-message">{toast.message}</span>
          <button
            type="button"
            className="error-toast-dismiss"
            aria-label={controls.errors.dismiss}
            onClick={() => dismissError(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
