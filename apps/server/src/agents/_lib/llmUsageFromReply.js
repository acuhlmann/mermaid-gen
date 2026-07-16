/** Pull `{ inputTokens, outputTokens }` from a LangChain reply, when the provider reports usage. */
export function llmUsageFromReply(reply) {
  const usage = reply?.usage_metadata ?? reply?.response_metadata?.tokenUsage ?? null;
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = usage.input_tokens ?? usage.promptTokens;
  const outputTokens = usage.output_tokens ?? usage.completionTokens;
  const out = {};
  if (Number.isFinite(inputTokens)) out.inputTokens = inputTokens;
  if (Number.isFinite(outputTokens)) out.outputTokens = outputTokens;
  return out.inputTokens != null || out.outputTokens != null ? out : null;
}
