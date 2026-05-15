/** Default MCP server name in Cursor / VS Code / Claude Code configs. */
export const MCP_SERVER_NAME = 'archislop';

/**
 * @param {string} name
 * @param {{ url: string } | Record<string, unknown>} config Transport config (not wrapped in mcpServers).
 */
export function buildCursorInstallUrl(name, config) {
  const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encoded}`;
}

/**
 * @param {{ name: string; type: string; url: string } & Record<string, unknown>} config
 */
export function buildVscodeInstallUrl(config) {
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

/**
 * @param {string} url
 */
export function buildMcpConfigSnippet(url) {
  return {
    mcpServers: {
      [MCP_SERVER_NAME]: { url }
    }
  };
}
