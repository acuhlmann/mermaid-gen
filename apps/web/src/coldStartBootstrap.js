import './coldStartGate.css';
import { COLD_START_COPY, pollHealthUntilReady } from './utils/coldStartGate.js';

const GATE_ID = 'cold-start-gate';
const TITLE_ID = 'cold-start-gate-title';
const HINT_ID = 'cold-start-gate-hint';
const RETRY_ID = 'cold-start-gate-retry';

function ensureGateElement() {
  let gate = document.getElementById(GATE_ID);
  if (gate) return gate;

  gate = document.createElement('div');
  gate.id = GATE_ID;
  gate.className = 'cold-start-gate';
  gate.setAttribute('role', 'status');
  gate.setAttribute('aria-live', 'polite');
  gate.innerHTML = `
    <div class="cold-start-gate-card">
      <p class="cold-start-gate-eyebrow" aria-hidden="true">🏗️ ${COLD_START_COPY.eyebrow}</p>
      <p class="cold-start-gate-title" id="${TITLE_ID}"></p>
      <p class="cold-start-gate-hint" id="${HINT_ID}"></p>
      <button type="button" class="cold-start-gate-retry" id="${RETRY_ID}" hidden>
        ${COLD_START_COPY.retryLabel}
      </button>
    </div>
  `;
  document.body.prepend(gate);
  return gate;
}

function setGatePhase(phase) {
  const title = document.getElementById(TITLE_ID);
  const hint = document.getElementById(HINT_ID);
  const retry = document.getElementById(RETRY_ID);
  if (!title || !hint || !retry) return;

  if (phase === 'checking') {
    title.textContent = COLD_START_COPY.checking.title;
    hint.textContent = COLD_START_COPY.checking.hint;
    hint.hidden = !COLD_START_COPY.checking.hint;
    retry.hidden = true;
    return;
  }

  if (phase === 'waking') {
    title.textContent = COLD_START_COPY.waking.title;
    hint.textContent = COLD_START_COPY.waking.hint;
    hint.hidden = false;
    retry.hidden = true;
    return;
  }

  title.textContent = COLD_START_COPY.timeout.title;
  hint.textContent = COLD_START_COPY.timeout.hint;
  hint.hidden = false;
  retry.hidden = false;
}

function hideGate() {
  const gate = document.getElementById(GATE_ID);
  if (!gate) return;
  gate.classList.add('is-hidden');
  gate.setAttribute('aria-hidden', 'true');
}

async function waitForServerReady() {
  ensureGateElement();
  setGatePhase('checking');

  const runPoll = async () => {
    const result = await pollHealthUntilReady({ onPhase: setGatePhase });
    if (result.ok) return true;

    const retryButton = document.getElementById(RETRY_ID);
    if (!retryButton) return false;

    return new Promise((resolve) => {
      const onRetry = async () => {
        retryButton.disabled = true;
        const retryResult = await pollHealthUntilReady({ onPhase: setGatePhase });
        retryButton.disabled = false;
        if (retryResult.ok) {
          retryButton.removeEventListener('click', onRetry);
          resolve(true);
        }
      };
      retryButton.addEventListener('click', onRetry);
    });
  };

  await runPoll();
  hideGate();
}

async function registerColdStartServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/cold-start-sw.js', { scope: '/' });
  } catch {
    // Optional — navigation 429 fallback is best-effort.
  }
}

await waitForServerReady();
await registerColdStartServiceWorker();
await import('./main.jsx');
