import express from 'express';
import { z } from 'zod';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { extractTextContent } from '../utils/extractTextContent.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { createApiRateLimitMiddleware } from '../middleware/apiRateLimit.js';
import {
  ADVISOR_PERSONAS,
  buildAdvisorSystemPrompt,
  buildAdvisorUserPrompt,
  createAdvisorChatModel,
  isAdvisorPersona,
  parseAdvisorReply
} from '../agents/advisorPrompts.js';

const FocusDescriptorSchema = z.object({
  id: z.string().max(200),
  label: z.string().max(200).optional(),
  kind: z.string().max(40).optional(),
  source: z.enum(['selected', 'hover']).optional()
});

const AdvisorSuggestSchema = z.object({
  persona: z.string().refine(isAdvisorPersona, { message: 'unknown persona' }),
  contentType: z.enum(['mermaid', 'infographic']).default('mermaid'),
  diagramSource: z.string().max(20_000).default(''),
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  focusNodeId: z.string().max(200).optional(),
  focusNode: FocusDescriptorSchema.optional(),
  lastSuggestions: z.array(z.string().max(400)).max(8).default([])
});

function safeErrorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

export function createAdvisorRouter() {
  const router = express.Router();
  router.use(createApiRateLimitMiddleware('llm'));

  router.post('/suggest', async (req, res) => {
    const parsed = AdvisorSuggestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid advisor payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const personaSpec = ADVISOR_PERSONAS[payload.persona];
    if (!personaSpec) {
      res.status(400).json({ error: 'Unknown persona' });
      return;
    }

    const trimmedSource = (payload.diagramSource ?? '').trim();
    if (!trimmedSource) {
      res.status(200).json({ persona: payload.persona, suggestion: null, highlightIds: [] });
      return;
    }

    let model;
    try {
      model = createAdvisorChatModel(process.env, payload.persona);
    } catch (error) {
      res.status(503).json({ error: safeErrorMessage(error) });
      return;
    }
    if (!model) {
      res.status(503).json({ error: 'Advisor LLM is not configured on this server.' });
      return;
    }

    const system = buildAdvisorSystemPrompt(payload.persona);
    const user = buildAdvisorUserPrompt({
      contentType: payload.contentType,
      diagramSource: trimmedSource,
      visibleLabels: payload.visibleLabels,
      focusNode: payload.focusNode ?? (payload.focusNodeId ? { id: payload.focusNodeId } : null),
      lastSuggestions: payload.lastSuggestions
    });

    try {
      const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
      const raw = extractTextContent(reply?.content ?? reply);
      const parsedReply = parseAdvisorReply(raw, { persona: payload.persona });
      if (!parsedReply) {
        res.status(200).json({ persona: payload.persona, suggestion: null, highlightIds: [], kind: 'comment' });
        return;
      }
      res.status(200).json({
        persona: payload.persona,
        suggestion: parsedReply.suggestion,
        highlightIds: parsedReply.highlightIds,
        kind: parsedReply.kind
      });
    } catch (error) {
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  });

  return router;
}
