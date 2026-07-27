/**
 * Minimal valid HTTP bodies for copilot route tests.
 * Import instead of copying `intentPayload()` from copilotRoute.test.js.
 */
export function intentPayload(overrides = {}) {
  return {
    prompt: 'Add an API gateway',
    revisionId: 0,
    diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    contentType: 'mermaid',
    temperature: 0.7,
    ...overrides
  };
}

export function transformPayload(overrides = {}) {
  return {
    mode: 'gilfoyle',
    revisionId: 0,
    diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    contentType: 'mermaid',
    ...overrides
  };
}

export function analyzePayload(overrides = {}) {
  return {
    kind: 'critique',
    revisionId: 0,
    diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    contentType: 'mermaid',
    ...overrides
  };
}
