import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
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
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const stateStore = createDiagramStateStore();
const agentService = createLazyMermaidAgentService({ stateStore });
const runtime = new CopilotRuntime({
  agents: {
    default: createCopilotRuntimeAgent({ agentService, stateStore })
  }
});

app.use(cors());
app.use(express.json());
app.use('/api/copilotkit', createCopilotRouter({ stateStore, agentService }));
app.use(
  createCopilotExpressHandler({
    runtime,
    basePath: '/api/copilotkit',
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function resolveDist(envPath, ...fallbacks) {
  if (envPath) return path.resolve(envPath);
  for (const p of fallbacks) {
    const full = path.join(repoRoot, p);
    if (fs.existsSync(full)) return full;
  }
  return path.join(repoRoot, fallbacks[fallbacks.length - 1] ?? 'apps/web/dist');
}

const mainDist = resolveDist(
  process.env.WEB_DIST_MAIN,
  'apps/web/dist-main',
  'apps/web/dist'
);
const hackathonDist = resolveDist(process.env.WEB_DIST_HACKATHON, 'apps/web/dist-hackathon');

const hasHackathonUi = fs.existsSync(path.join(hackathonDist, 'index.html'));
const hasMainUi = fs.existsSync(path.join(mainDist, 'index.html'));

if (hasHackathonUi) {
  app.use('/hackathon', express.static(hackathonDist));
}

if (hasMainUi) {
  app.use(express.static(mainDist));
}

if (hasHackathonUi) {
  app.get(/^\/hackathon(\/.*)?$/, (req, res, next) => {
    res.sendFile(path.join(hackathonDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

if (hasMainUi) {
  app.get(/^(?!\/api\/)(?!\/hackathon).*/, (req, res, next) => {
    res.sendFile(path.join(mainDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
server.ref();

export { app, runtime, stateStore, agentService, server };
