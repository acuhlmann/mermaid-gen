import { bootstrapServer } from './bootstrapServer.js';

const { app, server, runtime, sessionRegistry, pairingCodeStore, agentTokenStore } =
  await bootstrapServer();

export { app, runtime, sessionRegistry, server, pairingCodeStore, agentTokenStore };
