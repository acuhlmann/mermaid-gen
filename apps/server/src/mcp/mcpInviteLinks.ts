/** Default MCP server name in Cursor / VS Code / Claude Code configs. */
export const MCP_SERVER_NAME = 'archislop';

/** Transport config (not wrapped in mcpServers). */
export function buildCursorInstallUrl(
  name: string,
  config: { url: string } | Record<string, unknown>
): string {
  const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encoded}`;
}

export function buildVscodeInstallUrl(
  config: { name: string; type: string; url: string } & Record<string, unknown>
): string {
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function buildMcpConfigSnippet(url: string): {
  mcpServers: Record<string, { url: string }>;
} {
  return {
    mcpServers: {
      [MCP_SERVER_NAME]: { url }
    }
  };
}
