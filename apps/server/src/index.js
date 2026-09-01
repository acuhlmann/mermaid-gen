import './config/patchGaxiosNativeFetch.js';
import express from 'express';

/**
 * @typedef {import('express').Express} Express
 * @typedef {import('node:http').Server} HttpServer
 * @typedef {import('@copilotkit/runtime/v2').CopilotRuntime} CopilotRuntime
 * @typedef {import('./state/sessionServices.js').SessionServicesRegistry} SessionServicesRegistry
 * @typedef {import('./state/pairingCodeStore.js').PairingCodeStore} PairingCodeStore
 * @typedef {import('./state/agentTokenStore.js').AgentTokenStore} AgentTokenStore
 *
 * @typedef {Object} ServerExports
 * @property {Express} app
 * @property {CopilotRuntime} runtime
 * @property {SessionServicesRegistry} sessionRegistry
 * @property {HttpServer} server
 * @property {PairingCodeStore} pairingCodeStore
 * @property {AgentTokenStore} agentTokenStore
 */

const port = Number(process.env.PORT ?? 4000);
const app = express();

/** @type {import('express').RequestHandler} */
let healthHandler = (_req, res) => {
  res.status(200).json({ status: 'starting', runtimeReady: false });
};

// Cloud Run startup probes need an open port before heavy module graphs load.
app.get('/api/health', (req, res) => healthHandler(req, res));

/** @type {ServerExports | null} */
let liveExports = null;

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

server.ref();

const { attachFullApp } = await import('./attachFullApp.js');
liveExports = await attachFullApp(app, server, (handler) => {
  healthHandler = handler;
});

export const { runtime, sessionRegistry, pairingCodeStore, agentTokenStore } = liveExports;
export { app, server };
