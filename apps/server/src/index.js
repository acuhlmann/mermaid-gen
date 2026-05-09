import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CopilotRuntime } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { createCopilotRuntimeAgent } from './agents/copilotRuntimeAgent.js';
import { createLazyMermaidAgentService, isLlmConfigured } from './agents/mermaidLangChainAgent.js';
import { createCopilotRouter } from './routes/copilot.js';
import { createDiagramStateStore } from './state/diagramStateStore.js';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: envPath });

const app = express();
const stateStore = createDiagramStateStore();
const agentService = createLazyMermaidAgentService({ stateStore });
const runtime = new CopilotRuntime({
  agents: {
    default: createCopilotRuntimeAgent({ agentService })
  }
});

app.use(cors());
app.use(express.json());
app.use('/api/copilotkit', createCopilotRouter({ stateStore, agentService }));
app.use(
  createCopilotExpressHandler({
    runtime,
    basePath: '/api/copilotkit',
    mode: 'single-route',
    cors: false
  })
);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtimeReady: Boolean(runtime),
    llmConfigured: isLlmConfigured(),
    hasMermaidMcp: Boolean(process.env.MERMAID_MCP_URL)
  });
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
server.ref();

export { app, runtime, stateStore, agentService, server };
