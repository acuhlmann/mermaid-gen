/**
 * Removes likely API keys and bearer tokens from error strings before they are
 * returned to clients, streamed over SSE, or logged. Third-party SDK errors can
 * occasionally echo Authorization headers or key-like blobs.
 */
export function redactSecrets(input) {
  if (input == null) return input;
  const text = typeof input === 'string' ? input : String(input);
  return (
    text
      // OpenRouter-style and similar sk-* tokens (long opaque segments)
      .replace(/\bsk-[a-z]{2,}-[a-zA-Z0-9_-]{24,}\b/gi, '[REDACTED]')
      .replace(/\bsk-[a-zA-Z0-9_-]{32,}\b/g, '[REDACTED]')
      // Bearer / basic-style credential snippets in messages
      .replace(/\bBearer\s+[a-zA-Z0-9._\-]+\b/gi, 'Bearer [REDACTED]')
      .replace(/\bBasic\s+[a-zA-Z0-9+/=]{16,}\b/gi, 'Basic [REDACTED]')
      // api_key=..., API-Key: ... style leaks
      .replace(/\b(api[_-]?key|authorization)\s*[:=]\s*[^\s"'&,]{12,}/gi, '$1: [REDACTED]')
  );
}
