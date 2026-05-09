import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { CopilotRuntime } from '@copilotkit/runtime';
import { createCopilotRouter } from './routes/copilot.js';

dotenv.config();

const app = express();
const runtime = new CopilotRuntime({});

app.use(cors());
app.use(express.json());
app.use('/api/copilotkit', createCopilotRouter());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtimeReady: Boolean(runtime),
    hasMermaidMcp: Boolean(process.env.MERMAID_MCP_URL)
  });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
