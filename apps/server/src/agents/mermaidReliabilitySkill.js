import { JSDOM } from 'jsdom';

const DIAGRAM_PREFIX_PATTERN = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|journey|mindmap|timeline|gitGraph|pie|quadrantChart|requirementDiagram|block-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|kanban|zenuml|sankey-beta|xychart-beta)\b/m;

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

async function ensureMermaidInitialized() {
  if (initialized) return mermaidApi;
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });

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
  try {
    const mermaid = await ensureMermaidInitialized();
    const parseResult = await mermaid.parse(source, { suppressErrors: true });
    if (parseResult === false) {
      return {
        valid: false,
        error: 'Mermaid parser rejected source: parse() returned false.',
        validator: 'local-parser'
      };
    }
    return { valid: true, validator: 'local-parser' };
  } catch (error) {
    return {
      valid: false,
      error: `Mermaid parser rejected source: ${sanitizeErrorMessage(error?.message ?? error)}`,
      validator: 'local-parser'
    };
  }
}

async function validateWithMcpServer(source) {
  const endpoint = process.env.MERMAID_MCP_URL;
  if (!endpoint) {
    return { valid: null, validator: 'mcp-disabled' };
  }

  const retries = clampPositiveInt(process.env.MERMAID_MCP_MAX_RETRIES, DEFAULT_MCP_MAX_RETRIES);
  const delayMs = clampPositiveInt(process.env.MERMAID_MCP_RETRY_DELAY_MS, DEFAULT_MCP_RETRY_DELAY_MS);

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
        return { valid: false, error: errorMessage, validator: 'mcp-server' };
      }

      const data = await response.json();
      if (data?.valid === false) {
        return {
          valid: false,
          error: sanitizeErrorMessage(data.error ?? 'MCP validation failed'),
          validator: 'mcp-server'
        };
      }

      return { valid: true, validator: 'mcp-server' };
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
    error: `MCP request failed: ${sanitizeErrorMessage(lastError?.message ?? lastError)}`
  };
}

export async function validateMermaidStrict(source) {
  const candidate = source?.trim();

  if (!candidate || !looksLikeMermaid(candidate)) {
    return {
      valid: false,
      error: 'Proposed source is not valid Mermaid syntax (missing known diagram type).',
      validator: 'heuristic'
    };
  }

  const mcpValidation = await validateWithMcpServer(candidate);
  if (mcpValidation.valid === false) {
    return mcpValidation;
  }

  const parserValidation = await validateWithLocalParser(candidate);
  if (!parserValidation.valid) {
    return parserValidation;
  }

  if (mcpValidation.valid === null) {
    const warnings = mcpValidation.error ? [mcpValidation.error] : [];
    return {
      valid: true,
      validator: 'local-parser-fallback',
      warnings
    };
  }

  return {
    valid: true,
    validator: 'mcp-plus-local-parser'
  };
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
        mermaidSource: nextSource.trim(),
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
