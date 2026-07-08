/**
 * Child-process entry for the Anything-mode runtime check. Reads an HTML
 * document from stdin, executes it in jsdom, and writes a JSON verdict to
 * stdout: `{ errors, warnings, blank }`.
 *
 * Runs as a SEPARATE PROCESS on purpose: `runScripts: 'dangerously'` executes
 * agent-generated JS, and jsdom is not a security boundary. The parent
 * (anythingRuntimeCheck.js) spawns this file with a clean environment (no API
 * keys), a capped heap, and a hard kill timeout, so a runaway or hostile
 * script cannot hang the server event loop or read secrets. Do not import
 * this module into the server process.
 *
 * The jsdom window is set up to approximate the client's sandboxed iframe
 * (allow-scripts only, CSP blocks network):
 * - localStorage/sessionStorage already throw in jsdom on opaque origins,
 *   matching the real sandbox; document.cookie is patched to throw too.
 * - fetch exists but always rejects, like fetch under connect-src 'none'.
 * - APIs real browsers have but jsdom lacks (canvas contexts, matchMedia,
 *   IntersectionObserver, ResizeObserver, AudioContext, …) get inert stubs so
 *   pages that use them are not falsely rejected.
 */

import { JSDOM, VirtualConsole } from 'jsdom';

const MAX_ERRORS = 5;
const MAX_WARNINGS = 8;
const MAX_MESSAGE_LENGTH = 400;

function truncate(value) {
  const text = String(value ?? '').trim();
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

function parseSettleMs(argv) {
  for (const arg of argv) {
    const match = /^--settle-ms=(\d+)$/.exec(arg);
    if (match) return Number(match[1]);
  }
  return 250;
}

/**
 * A permissive stand-in for objects jsdom cannot provide (canvas contexts,
 * audio nodes, …): every property access returns another inert value, every
 * call succeeds. `then` is explicitly undefined so `await inert` resolves
 * instead of hanging on thenable assimilation.
 */
function createInert() {
  const inert = new Proxy(function inertStub() {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : '');
      if (prop === Symbol.iterator) {
        return function* inertIterator() {};
      }
      return inert;
    },
    set() {
      return true;
    },
    apply() {
      return inert;
    },
    construct() {
      return inert;
    }
  });
  return inert;
}

/** Stub APIs that exist in real browsers so their absence in jsdom does not fail good pages. */
function installBrowserApiStubs(window) {
  const inert = createInert();

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false,
      media: String(query),
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      }
    });
  }

  for (const name of ['IntersectionObserver', 'ResizeObserver']) {
    if (typeof window[name] !== 'function') {
      window[name] = class ObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      };
    }
  }

  for (const name of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext']) {
    if (typeof window[name] !== 'function') {
      window[name] = function AudioContextStub() {
        return inert;
      };
    }
  }

  if (typeof window.requestIdleCallback !== 'function') {
    window.requestIdleCallback = (cb) =>
      window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1);
    window.cancelIdleCallback = (id) => window.clearTimeout(id);
  }

  if (
    window.HTMLCanvasElement &&
    typeof window.HTMLCanvasElement.prototype.getContext === 'function'
  ) {
    // jsdom returns null (and logs "not implemented") without the native
    // `canvas` package; code like getContext('2d').fillRect(...) would then
    // throw a false TypeError. Real sandboxed iframes do have canvas.
    window.HTMLCanvasElement.prototype.getContext = function getContextStub() {
      return inert;
    };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
  }

  if (window.HTMLMediaElement) {
    window.HTMLMediaElement.prototype.play = function play() {
      return Promise.resolve();
    };
    window.HTMLMediaElement.prototype.pause = function pause() {};
    window.HTMLMediaElement.prototype.load = function load() {};
  }

  if (window.Element && typeof window.Element.prototype.animate !== 'function') {
    window.Element.prototype.animate = function animate() {
      return inert;
    };
  }

  if (typeof window.speechSynthesis === 'undefined') {
    window.speechSynthesis = inert;
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtteranceStub() {
      return inert;
    };
  }
}

/** Make jsdom stricter where the real sandbox is stricter. */
function installSandboxContract(window) {
  // Sandboxed iframes without allow-same-origin throw on document.cookie;
  // jsdom silently accepts it, which would hide a real-sandbox breakage.
  Object.defineProperty(window.document, 'cookie', {
    configurable: true,
    get() {
      throw new window.DOMException(
        'document.cookie is unavailable inside the sandboxed canvas (opaque origin).',
        'SecurityError'
      );
    },
    set() {
      throw new window.DOMException(
        'document.cookie is unavailable inside the sandboxed canvas (opaque origin).',
        'SecurityError'
      );
    }
  });

  // The iframe CSP is connect-src 'none': fetch exists but every request
  // fails. jsdom has no fetch at all, which would surface as a confusing
  // ReferenceError instead of the real failure mode.
  window.fetch = () =>
    Promise.reject(
      new window.TypeError('Failed to fetch: network access is disabled in the sandboxed canvas.')
    );
}

/** True when <body> contains something that could paint: any non-metadata element or bare text. */
function hasVisibleContent(document) {
  const body = document.body;
  if (!body) return false;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'META', 'LINK', 'TITLE']);
  for (const el of body.querySelectorAll('*')) {
    if (!SKIP.has(el.tagName)) return true;
  }
  for (const node of body.childNodes) {
    if (node.nodeType === 3 && node.textContent && node.textContent.trim()) return true;
  }
  return false;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function emit(result) {
  process.stdout.write(JSON.stringify(result));
}

async function main() {
  const settleMs = parseSettleMs(process.argv.slice(2));
  const html = await readStdin();

  const errors = [];
  const warnings = [];
  const seen = new Set();
  const pushUnique = (list, max, message) => {
    const text = truncate(message);
    if (!text || seen.has(text)) return;
    seen.add(text);
    if (list.length < max) list.push(text);
  };

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    const message = String(error?.message ?? error);
    if (error?.type === 'unhandled-exception') {
      // "Uncaught [ReferenceError: x is not defined]" → unwrap the inner error.
      const inner = /^Uncaught \[([\s\S]*)\]$/.exec(message);
      pushUnique(errors, MAX_ERRORS, inner ? inner[1] : message);
      return;
    }
    // "Not implemented: …" and friends — jsdom gaps, not page bugs.
    pushUnique(warnings, MAX_WARNINGS, message);
  });
  virtualConsole.on('error', (...args) => {
    pushUnique(warnings, MAX_WARNINGS, `console.error: ${args.map((a) => String(a)).join(' ')}`);
  });

  // Rejections from page promises surface on the process, not the virtual console.
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
    pushUnique(errors, MAX_ERRORS, `Unhandled promise rejection: ${message}`);
  });

  let dom;
  try {
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(window) {
        installBrowserApiStubs(window);
        installSandboxContract(window);
      }
    });
  } catch (error) {
    // jsdom itself failing to construct the document is a document problem.
    emit({
      errors: [
        truncate(`Document failed to load: ${error instanceof Error ? error.message : error}`)
      ],
      warnings,
      blank: true
    });
    process.exit(0);
  }

  const { window } = dom;

  // Classic scripts already ran during construction. Wait for `load`, then a
  // settle window so DOMContentLoaded/setTimeout/requestAnimationFrame init
  // code runs before we take the verdict.
  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') {
      resolve();
      return;
    }
    const cap = setTimeout(resolve, 1000);
    window.addEventListener('load', () => {
      clearTimeout(cap);
      resolve();
    });
  });
  await new Promise((resolve) => setTimeout(resolve, settleMs));

  const blank = !hasVisibleContent(window.document);

  emit({ errors, warnings, blank });
  try {
    window.close();
  } catch {
    // Closing is best-effort; the process exits regardless.
  }
  process.exit(0);
}

main().catch((error) => {
  emit({
    errors: [
      truncate(`Runtime sandbox crashed: ${error instanceof Error ? error.message : error}`)
    ],
    warnings: [],
    blank: false,
    crashed: true
  });
  process.exit(1);
});
