import { toolCallLimitMiddleware } from 'langchain';

const RECURSION_CLAMP = Object.freeze({ min: 25, max: 200 });
/** LangGraph default is 25; we default higher to tolerate multi-step ReAct without env tuning. */
export const DEFAULT_MERMAID_AGENT_RECURSION_LIMIT = 50;

const TOOL_RUN_CLAMP = Object.freeze({ min: 4, max: 40 });
export const DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN = 6;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveAgentRecursionLimit(env = process.env) {
  const raw = env.MERMAID_AGENT_RECURSION_LIMIT;
  if (raw === undefined || raw === '') return DEFAULT_MERMAID_AGENT_RECURSION_LIMIT;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return DEFAULT_MERMAID_AGENT_RECURSION_LIMIT;
  return Math.min(RECURSION_CLAMP.max, Math.max(RECURSION_CLAMP.min, n));
}

/**
 * Run-level tool cap per graph invocation. Returns null to disable middleware (e.g. MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN=0).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number | null}
 */
export function resolveAgentToolCallRunLimit(env = process.env) {
  const raw = env.MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN;
  if (raw === undefined || raw === '') return DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN;
  if (n <= 0) return null;
  return Math.min(TOOL_RUN_CLAMP.max, Math.max(TOOL_RUN_CLAMP.min, n));
}

/**
 * Runnable config for LangGraph-backed createAgent invocations.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ recursionLimit: number }}
 */
export function getAgentRunnableConfig(env = process.env) {
  return { recursionLimit: resolveAgentRecursionLimit(env) };
}

/**
 * Middleware that stops excessive tool churn within one agent run.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createDiagramAgentMiddleware(env = process.env) {
  const runLimit = resolveAgentToolCallRunLimit(env);
  if (runLimit == null) return [];
  return [
    toolCallLimitMiddleware({
      runLimit,
      exitBehavior: 'end'
    })
  ];
}
