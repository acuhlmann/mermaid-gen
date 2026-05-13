import { JSDOM } from 'jsdom';

const DIAGRAM_PREFIX_PATTERN = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|journey|mindmap|timeline|gitGraph|pie|quadrantChart|requirementDiagram|block-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|kanban|zenuml|sankey-beta|xychart-beta)\b/m;

const DEFAULT_REPAIR_MAX_ATTEMPTS = Number.parseInt(process.env.MERMAID_REPAIR_MAX_ATTEMPTS ?? '1', 10);
const DEFAULT_MCP_MAX_RETRIES = Number.parseInt(process.env.MERMAID_MCP_MAX_RETRIES ?? '2', 10);
const DEFAULT_MCP_RETRY_DELAY_MS = Number.parseInt(process.env.MERMAID_MCP_RETRY_DELAY_MS ?? '150', 10);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    securityLevel: 'loose'
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

async function validateWithMcpServer(source) {
  const endpoint = process.env.MERMAID_MCP_URL;
  if (!endpoint) {
    return { valid: null, validator: 'mcp-disabled', durationMs: 0 };
  }

  const retries = clampPositiveInt(process.env.MERMAID_MCP_MAX_RETRIES, DEFAULT_MCP_MAX_RETRIES);
  const delayMs = clampPositiveInt(process.env.MERMAID_MCP_RETRY_DELAY_MS, DEFAULT_MCP_RETRY_DELAY_MS);

  const started = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mermaidSource: source })
      });

      if (!response.ok) {
        const shouldRetry = response.status >= 500 || response.status === 429;
        const errorMessage = `MCP returned ${response.status}`;
        if (shouldRetry && attempt < retries) {
          await sleep(delayMs * (attempt + 1));
          continue;
        }
        return { valid: false, error: errorMessage, validator: 'mcp-server', durationMs: Date.now() - started };
      }

      const data = await response.json();
      if (data?.valid === false) {
        return {
          valid: false,
          error: sanitizeErrorMessage(data.error ?? 'MCP validation failed'),
          validator: 'mcp-server',
          durationMs: Date.now() - started
        };
      }

      // Require explicit boolean true. Anything else (missing/null/non-bool) is treated as
      // "MCP didn't actually validate" so a misconfigured endpoint that returns {} or HTML
      // can no longer silently pass everything.
      if (data?.valid === true) {
        return { valid: true, validator: 'mcp-server', durationMs: Date.now() - started };
      }

      return {
        valid: null,
        validator: 'mcp-inconclusive',
        error: 'MCP response missing explicit valid:true (treating as unavailable).',
        durationMs: Date.now() - started
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }
    }
  }

  return {
    valid: null,
    validator: 'mcp-unavailable',
    error: `MCP request failed: ${sanitizeErrorMessage(lastError?.message ?? lastError)}`,
    durationMs: Date.now() - started
  };
}

function mcpIsAuthoritative() {
  const raw = process.env.MERMAID_MCP_AUTHORITATIVE;
  if (raw == null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export async function validateMermaidStrict(source) {
  const candidate = source?.trim();
  const timings = { heuristic: 0, local: 0, mcp: 0 };

  if (!candidate || !looksLikeMermaid(candidate)) {
    return {
      valid: false,
      error: 'Proposed source is not valid Mermaid syntax (missing known diagram type).',
      validator: 'heuristic',
      timings
    };
  }

  const mcpEnabled = Boolean(process.env.MERMAID_MCP_URL);
  const authoritative = mcpEnabled && mcpIsAuthoritative();

  // Local parser is in-process, JSDOM is warmed at boot (apps/server/src/index.js:120),
  // so parse is ~1–5 ms. MCP is an HTTP hop (≥10–100 ms RTT). Run local first and reserve
  // MCP for an optional second-opinion warning unless the operator explicitly marks MCP
  // authoritative.
  const parserValidation = await validateWithLocalParser(candidate);
  timings.local = parserValidation.durationMs ?? 0;

  if (!parserValidation.valid) {
    if (authoritative) {
      const mcpValidation = await validateWithMcpServer(candidate);
      timings.mcp = mcpValidation.durationMs ?? 0;
      if (mcpValidation.valid === true) {
        return {
          valid: true,
          validator: 'mcp-overrode-local',
          warnings: [`Local parser rejected source but MCP accepted: ${parserValidation.error}`],
          timings
        };
      }
    }
    return { ...parserValidation, timings };
  }

  if (!mcpEnabled) {
    return { valid: true, validator: 'local-parser', timings };
  }

  const mcpValidation = await validateWithMcpServer(candidate);
  timings.mcp = mcpValidation.durationMs ?? 0;

  if (authoritative && mcpValidation.valid === false) {
    return { ...mcpValidation, timings };
  }

  if (mcpValidation.valid === false) {
    return {
      valid: true,
      validator: 'local-parser',
      warnings: [`MCP disagreed (treating as advisory): ${mcpValidation.error ?? 'MCP rejected source'}`],
      timings
    };
  }

  if (mcpValidation.valid === null) {
    const warnings = mcpValidation.error ? [mcpValidation.error] : [];
    return { valid: true, validator: 'local-parser-fallback', warnings, timings };
  }

  return { valid: true, validator: 'mcp-plus-local-parser', timings };
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
