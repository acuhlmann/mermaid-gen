import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@copilotkit/react-core/v2/styles.css';
import './index.css';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { installUxSignals } from './state/uxSignalsClient.js';

let mounted = false;

/**
 * Mount the React shell. Deferred until the server health gate passes so hydrate
 * does not race a scale-to-zero wake. Monaco loads lazily when the code editor opens.
 */
export async function mountArchislopApp() {
  if (mounted) return;
  mounted = true;

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Missing #root mount point');
  }
  // Content-free usage signals for ArchiSlop God (ADR-0019); respects the Settings opt-out.
  installUxSignals();

  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>
  );
}
