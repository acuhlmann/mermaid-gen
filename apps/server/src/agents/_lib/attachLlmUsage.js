import { llmUsageFromReply } from './llmUsageFromReply.js';

/**
 * Attach `{ inputTokens, outputTokens }` from a LangChain reply onto a fixer /
 * classifier result so callers can bill the Stakeholder Damage Report.
 *
 * @param {object} result
 * @param {unknown} reply
 * @returns {object}
 */
export function withLlmUsage(result, reply) {
  const usage = llmUsageFromReply(reply);
  if (!usage) return result;
  return { ...result, usage };
}
