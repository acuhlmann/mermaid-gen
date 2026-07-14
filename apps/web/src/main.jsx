import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@copilotkit/react-core/v2/styles.css';
import './index.css';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

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

  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>
  );
}
