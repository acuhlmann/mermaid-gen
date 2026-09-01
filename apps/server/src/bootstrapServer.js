import './config/patchGaxiosNativeFetch.js';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProductionInviteSecret } from './utils/inviteToken.js';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: envPath });

const vertexProjectId = process.env.VERTEX_PROJECT_ID?.trim();
if (vertexProjectId && !process.env.GOOGLE_CLOUD_PROJECT?.trim()) {
  process.env.GOOGLE_CLOUD_PROJECT = vertexProjectId;
}

/**
 * Cloud Run allows 240s for the container to accept traffic on PORT. Heavy
 * route/MCP imports can exceed that on cold start; bind a stub health route
 * first so startup probes succeed while the rest of the app loads.
 */
export async function bootstrapServer() {
  assertProductionInviteSecret();

  const app = express();
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  let runtimeReady = false;
  app.get('/api/health', (_req, res, next) => {
    if (!runtimeReady) {
      res.json({ status: 'starting', runtimeReady: false });
      return;
    }
    next();
  });

  const port = Number(process.env.PORT ?? 4000);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve(listener));
    listener.on('error', reject);
  });
  server.ref();
  console.log(`Server listening at http://localhost:${port}`);

  const loaded = await import('./loadServerApp.js');
  const services = await loaded.attachRoutes(app);
  runtimeReady = true;

  console.log(`Pairing store: ${services.pairingStoreBackend}`);
  services.ensureMermaidInitialized().catch((error) => {
    console.warn(
      'Mermaid validator warm-up failed (will lazy-init on first request):',
      error?.message ?? error
    );
  });

  return {
    app,
    server,
    runtime: services.runtime,
    sessionRegistry: services.sessionRegistry,
    pairingCodeStore: services.pairingCodeStore,
    agentTokenStore: services.agentTokenStore
  };
}
