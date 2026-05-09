import { DiagramPatchSchema } from '@mermaid-architect/shared';

function looksLikeMermaid(source) {
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|journey|mindmap)/m.test(source.trim());
}

async function validateWithMcpServer(source) {
  const endpoint = process.env.MERMAID_MCP_URL;
  if (!endpoint) {
    return { valid: true, validator: 'local-fallback' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mermaidSource: source })
    });

    if (!response.ok) {
      return { valid: false, error: `MCP returned ${response.status}` };
    }

    const data = await response.json();
    if (data?.valid === false) {
      return { valid: false, error: data.error ?? 'MCP validation failed' };
    }

    return { valid: true, validator: 'mcp-server' };
  } catch (error) {
    return { valid: false, error: `MCP request failed: ${error.message}` };
  }
}

export async function validateAndPreparePatch({ currentState, proposedMermaidSource, reason }) {
  const candidate = proposedMermaidSource?.trim();

  if (!candidate || !looksLikeMermaid(candidate)) {
    return {
      accepted: false,
      error: 'Proposed source is not valid Mermaid syntax (missing known diagram type).'
    };
  }

  const mcpValidation = await validateWithMcpServer(candidate);
  if (!mcpValidation.valid) {
    return {
      accepted: false,
      error: mcpValidation.error
    };
  }

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    mermaidSource: candidate,
    reason
  });

  return {
    accepted: true,
    patch,
    metadata: { validator: mcpValidation.validator }
  };
}
