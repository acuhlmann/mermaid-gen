import { HttpAgent } from '@ag-ui/client';
import type { AgentStreamPayloadBody } from './diagramWireTypes.js';

type HttpAgentConfig = ConstructorParameters<typeof HttpAgent>[0];

/**
 * HttpAgent wired up for archislop's POST /api/copilotkit/agent-stream endpoint.
 *
 * The route validates AgentStreamPayloadSchema (operation/kind/mode/revisionId/diagramSource/...),
 * not RunAgentInput, so requestInit is overridden to put that payload on the wire while we still
 * benefit from HttpAgent's SSE decode + AG-UI event validation pipeline.
 */
export class CopilotStreamHttpAgent extends HttpAgent {
  private readonly _streamPayload: AgentStreamPayloadBody;

  constructor(config: HttpAgentConfig, streamPayload: AgentStreamPayloadBody) {
    super(config);
    this._streamPayload = streamPayload;
  }

  override requestInit(_input: unknown) {
    return {
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        accept: 'text/event-stream'
      },
      body: JSON.stringify(this._streamPayload),
      signal: this.abortController.signal
    };
  }
}
