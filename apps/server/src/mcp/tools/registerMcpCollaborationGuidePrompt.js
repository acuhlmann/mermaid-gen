/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerMcpCollaborationGuidePrompt(server) {
  server.registerPrompt(
    'archislop_collaboration_guide',
    {
      title: 'How to collaborate in an ArchiSlop session',
      description:
        'A short system-prompt-style brief teaching the model how to be a useful guest in a live ArchiSlop diagram session.'
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are connected to a live ArchiSlop diagram session as an external agent.',
              '',
              'MCP Apps (SEP-1865): several tools render interactive UIs in MCP hosts (Cursor, Claude Desktop, VS Code):',
              '- `open_welcome` / `get_session_bootstrap` → onboarding checklist and revision ids',
              '- `open_session_pairing` / `join_session` → paste pairing code from Invite agent (stable /mcp URL)',
              '- `register_agent` → handshake approval card',
              '- `open_session_events` → live collaboration feed (SSE + long-poll fallback)',
              '- `open_diagram_canvas` / `open_focus_picker` → canvas preview + node focus',
              '- `propose_diagram_edit` / `open_proposal_review` → side-by-side proposal review (accept/reject in the host)',
              '- `open_session_dashboard` → war room (presence + handshakes + pending proposals)',
              '- `open_my_proposals` → your proposal inbox (wait for resolution)',
              '- `open_insights_feed` / `open_compose_insight` / `get_insights` → Thinking-pane comments',
              '- `open_critique_review` / `drop_insight` (critique) → actionable checklist with fix request',
              '',
              'Conventions:',
              '- On a stable /mcp URL, call `open_session_pairing` or `join_session({ pairingCode })` before anything else.',
              '- Call `get_session_bootstrap` after binding for a one-shot checklist and revision ids.',
              '- Call `register_agent` once the room is bound (default: non-blocking). Poll `get_handshake_status` or use `subscribe_session_events`.',
              '- After approval, call `open_diagram_canvas` once to align visually, then `get_session_state` before proposing.',
              '- Use `open_session_events` or `subscribe_session_events` instead of polling proposals when possible.',
              '- Edits go through `propose_diagram_edit` — NEVER auto-applied.',
              '- Always include a one-sentence `reason` so the human understands WHY.',
              '- Use `set_focus` before proposing changes to a specific node.',
              '- Use `drop_insight` (variant critique) then `open_critique_review` for structured review.',
              '- Use `react` sparingly.',
              '- Be a good guest: small, well-motivated, frequent contributions beat one giant rewrite.'
            ].join('\n')
          }
        }
      ]
    })
  );
}
