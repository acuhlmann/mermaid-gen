import './config/patchGaxiosNativeFetch.js';
import dotenv from 'dotenv';
import express from 'express';
import { buildProductionContentSecurityPolicy } from './security/productionCsp.js';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CopilotRuntime } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { createSessionAwareCopilotRuntimeAgent } from './agents/copilotRuntimeAgent.js';
import {
  isLlmConfigured,
  resolveDecorativeModelLabel,
  resolveLlmBackend,
  resolveLlmModelLabel
} from './agents/mermaidLangChainAgent.js';
import { isOfficeTtsEnabled } from './agents/officeTts.js';
import { isAgentCostEstimateEnabled } from '@archislop/shared';
import {
  getCachedLlmCostRates,
  scheduleLlmCostRatesRefresh
} from './config/llmCostRatesRefresh.js';
import { ensureMermaidInitialized } from './agents/mermaidReliabilitySkill.js';
import { createCopilotRouter } from './routes/copilot.js';
import { createAdvisorRouter } from './routes/advisor.js';
import { createOfficeRouter } from './routes/office.js';
import { createDiagramRepairRouter } from './routes/diagramRepair.js';
import {
  createSessionServicesRegistry,
  resolveSessionIdFromRequest,
  resolveSessionIdFromCopilotInput
} from './state/sessionServices.js';
import { createMcpHandler } from './mcp/mcpServer.js';
import { createPairingCodeStoreFromEnv } from './state/pairingCodeStoreFactory.js';
import { createAgentTokenStore } from './state/agentTokenStore.js';
import { createMcpRateLimiter } from './mcp/mcpRateLimit.js';
import {
  createVisitorBadgeGate,
  createVisitorBadgeUnlockHandler
} from './middleware/visitorBadge.js';

scheduleLlmCostRatesRefresh(process.env);

const { store: pairingCodeStore, backend: pairingStoreBackend } =
  await createPairingCodeStoreFromEnv();
const agentTokenStore = createAgentTokenStore();
const mcpRateLimiter = createMcpRateLimiter();

/**
 * @param {import('express').Express} app
 */
export async function attachRoutes(app) {
  const sessionRegistry = createSessionServicesRegistry();

  const runtime = new CopilotRuntime({
    agents: {
      default: createSessionAwareCopilotRuntimeAgent({
        getSessionServicesForInput: (input) => {
          const sessionId = resolveSessionIdFromCopilotInput(input);
          return sessionRegistry.getSessionServices(sessionId);
        }
      })
    }
  });

  app.use(cors(buildCorsOptions()));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Security-Policy', buildProductionContentSecurityPolicy());
    }
    next();
  });
  app.use(express.json());
  app.post('/api/visitor-badge', createVisitorBadgeUnlockHandler());
  app.use(createVisitorBadgeGate());
  app.use(
    '/api/copilotkit',
    createCopilotRouter({
      resolveServices: (req) => sessionRegistry.getSessionServicesForRequest(req),
      sessionExists: (sessionId) => sessionRegistry.hasSession(sessionId),
      pairingCodeStore,
      agentTokenStore,
      sessionRegistry
    })
  );
  app.use('/api/advisor', createAdvisorRouter());
  app.use('/api/office', createOfficeRouter());
  app.use(
    '/api/diagram',
    createDiagramRepairRouter({
      resolveServices: (req) => sessionRegistry.getSessionServicesForRequest(req)
    })
  );

  app.all(
    '/mcp',
    createMcpHandler({
      sessionRegistry,
      pairingCodeStore,
      agentTokenStore,
      mcpRateLimiter
    })
  );
  app.use(
    createCopilotExpressHandler({
      runtime,
      basePath: '/api/copilotkit',
      cors: false
    })
  );

  app.get('/api/health', (_req, res) => {
    const ratesSnapshot = getCachedLlmCostRates(process.env);
    res.json({
      status: 'ok',
      runtimeReady: Boolean(runtime),
      llmConfigured: isLlmConfigured(),
      officeTtsConfigured: isOfficeTtsEnabled(),
      llmBackend: resolveLlmBackend() ?? 'none',
      llmBackendsByProfile: {
        fast: resolveLlmBackend(process.env, 'fast') ?? 'none',
        quality: resolveLlmBackend(process.env, 'quality') ?? 'none'
      },
      llmModelsByProfile: {
        fast: resolveLlmModelLabel(process.env, 'fast') ?? 'none',
        quality: resolveLlmModelLabel(process.env, 'quality') ?? 'none',
        decorative: resolveDecorativeModelLabel(process.env) ?? 'none'
      },
      agentCostEstimates: {
        enabled: isAgentCostEstimateEnabled(process.env),
        pricingUrl: ratesSnapshot.pricingUrl,
        rates: ratesSnapshot.rates,
        ratesVersion: ratesSnapshot.version,
        ratesUpdatedAt: ratesSnapshot.updatedAtMs,
        ratesSources: ratesSnapshot.sources
      },
      pairingStore: pairingStoreBackend,
      mcpSessionAffinity: 'in-process',
      hint:
        pairingStoreBackend === 'memory'
          ? 'Set REDIS_URL for cross-instance pairing; use Cloud Run min-instances=1 for MCP transport stickiness.'
          : undefined
    });
  });

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

  const mainDist = resolveDist(process.env.WEB_DIST_MAIN, 'apps/web/dist-main', 'apps/web/dist');
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

  return {
    runtime,
    sessionRegistry,
    pairingCodeStore,
    agentTokenStore,
    pairingStoreBackend,
    ensureMermaidInitialized
  };
}

function buildCorsOptions() {
  if (process.env.NODE_ENV !== 'production') return {};
  const origins = [];
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (base) origins.push(base);
  const extra = process.env.CORS_ALLOWED_ORIGINS;
  if (typeof extra === 'string' && extra.trim()) {
    for (const part of extra.split(',')) {
      const trimmed = part.trim();
      if (trimmed) origins.push(trimmed);
    }
  }
  if (origins.length === 0) return {};
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS not allowed'));
    }
  };
}

function resolveDist(envPath, ...fallbacks) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  if (envPath) return path.resolve(envPath);
  for (const p of fallbacks) {
    const full = path.join(repoRoot, p);
    if (fs.existsSync(full)) return full;
  }
  return path.join(repoRoot, fallbacks[fallbacks.length - 1] ?? 'apps/web/dist');
}
