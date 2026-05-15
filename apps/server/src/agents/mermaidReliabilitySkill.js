import { JSDOM } from 'jsdom';

const DIAGRAM_PREFIX_PATTERN = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|journey|mindmap|timeline|gitGraph|pie|quadrantChart|requirementDiagram|block-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|kanban|zenuml|sankey-beta|xychart-beta)\b/m;

const DEFAULT_REPAIR_MAX_ATTEMPTS = Number.parseInt(process.env.MERMAID_REPAIR_MAX_ATTEMPTS ?? '1', 10);

let initialized = false;
let mermaidApi = null;

function clampPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function sanitizeErrorMessage(message) {
  if (!message) return 'Mermaid validation failed.';
  return String(message).trim().slice(0, 2000);
}

/**
 * Lazily boots a JSDOM + Mermaid environment used to validate diagram source on the server.
 * Exported so the server can warm the import at startup, so the first user action doesn't pay JSDOM cold start.
 */
export async function ensureMermaidInitialized() {
  if (initialized) return mermaidApi;
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });
  if (!dom.window.SVGElement.prototype.getBBox) {
    Object.defineProperty(dom.window.SVGElement.prototype, 'getBBox', {
      configurable: true,
      value() {
        const text = this.textContent ?? '';
        return { x: 0, y: 0, width: Math.max(1, text.length * 8), height: 16 };
      }
    });
  }
  if (!dom.window.SVGElement.prototype.getComputedTextLength) {
    Object.defineProperty(dom.window.SVGElement.prototype, 'getComputedTextLength', {
      configurable: true,
      value() {
        return Math.max(1, (this.textContent ?? '').length * 8);
      }
    });
  }

  const mermaidModule = await import('mermaid');
  mermaidApi = mermaidModule.default;

  mermaidApi.initialize({
    startOnLoad: false,
    securityLevel: 'strict'
  });
  initialized = true;
  return mermaidApi;
}

export function looksLikeMermaid(source) {
  return DIAGRAM_PREFIX_PATTERN.test(source.trim());
}

export function isSyntaxValidationError(error) {
  const text = String(error ?? '').toLowerCase();
  return text.includes('mermaid') || text.includes('diagram') || text.includes('syntax') || text.includes('parse');
}

async function validateWithLocalParser(source) {
  const started = Date.now();
  try {
    const mermaid = await ensureMermaidInitialized();
    const parseResult = await mermaid.parse(source, { suppressErrors: true });
    if (parseResult === false) {
      return {
        valid: false,
        error: 'Mermaid parser rejected source: parse() returned false.',
        validator: 'local-parser',
        durationMs: Date.now() - started
      };
    }
    return { valid: true, validator: 'local-parser', durationMs: Date.now() - started };
  } catch (error) {
    return {
      valid: false,
      error: `Mermaid parser rejected source: ${sanitizeErrorMessage(error?.message ?? error)}`,
      validator: 'local-parser',
      durationMs: Date.now() - started
    };
  }
}

export async function validateMermaidStrict(source) {
  const candidate = source?.trim();
  const timings = { heuristic: 0, local: 0 };

  if (!candidate || !looksLikeMermaid(candidate)) {
    return {
      valid: false,
      error: 'Proposed source is not valid Mermaid syntax (missing known diagram type).',
      validator: 'heuristic',
      timings
    };
  }

  const parserValidation = await validateWithLocalParser(candidate);
  timings.local = parserValidation.durationMs ?? 0;

  if (!parserValidation.valid) {
    return { ...parserValidation, timings };
  }

  return { valid: true, validator: 'local-parser', timings };
}

export async function attemptRepair({ source, error, maxAttempts = DEFAULT_REPAIR_MAX_ATTEMPTS, repair }) {
  const retries = clampPositiveInt(maxAttempts, DEFAULT_REPAIR_MAX_ATTEMPTS);
  let currentSource = source;
  let currentError = sanitizeErrorMessage(error);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const nextSource = await repair({
      source: currentSource,
      error: currentError,
      attempt
    });

    if (!nextSource || nextSource.trim() === currentSource.trim()) {
      return {
        accepted: false,
        error: 'Repair attempt did not produce a new Mermaid source.',
        attempts: attempt
      };
    }

    const validation = await validateMermaidStrict(nextSource);
    if (validation.valid) {
      return {
        accepted: true,
        diagramSource: nextSource.trim(),
        attempts: attempt,
        metadata: { validator: validation.validator, warnings: validation.warnings ?? [] }
      };
    }

    currentSource = nextSource;
    currentError = validation.error;
  }

  return {
    accepted: false,
    error: `Repair attempts exhausted. Last error: ${currentError}`,
    attempts: retries
  };
}
