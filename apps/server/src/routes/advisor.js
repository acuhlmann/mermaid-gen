import express from 'express';
import { z } from 'zod';
import { ContentTypeSchema, fallbackLabelGibberish } from '@archislop/shared';
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
import { explainLabelOnce } from '../agents/labelExplainer.js';

const FocusDescriptorSchema = z.object({
  id: z.string().max(200),
  label: z.string().max(200).optional(),
  kind: z.string().max(40).optional(),
  selectionKind: z
    .enum(['node', 'cluster', 'edge', 'infographic-item', 'infographic-region', 'chart-mark'])
    .optional(),
  source: z.enum(['selected', 'hover']).optional(),
  indexes: z.string().max(64).optional(),
  elementType: z.string().max(64).optional(),
  clickedLabel: z.string().max(240).optional()
});

const AdvisorSuggestSchema = z.object({
  persona: z.string().refine(isAdvisorPersona, { message: 'unknown persona' }),
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string().max(20_000).default(''),
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  focusNodeId: z.string().max(200).optional(),
  focusNode: FocusDescriptorSchema.optional(),
  lastSuggestions: z.array(z.string().max(400)).max(8).default([]),
  // "dumb" rephrases the architect's previous bubble in plain English. Only honored
  // when persona === 'explain' (other personas ignore the flag at prompt-build time).
  mode: z.enum(['dumb']).optional(),
  previousSuggestion: z.string().max(400).optional(),
  // Progressive simplification (1–6) — same ladder as the radial "?" explainer.
  simpleLevel: z.number().int().min(1).max(6).optional(),
  style: z.enum(['gibberish']).optional()
});

const ExplainLabelSchema = z.object({
  partKind: z.string().max(40).optional(),
  partName: z.string().max(240),
  label: z.string().max(240).optional(),
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string().max(20_000).default(''),
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  style: z.enum(['brief', 'simple', 'gibberish']).default('brief'),
  simpleLevel: z.number().int().min(1).max(6).optional()
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

    const system = buildAdvisorSystemPrompt(payload.persona, payload.contentType, {
      mode: payload.mode,
      simpleLevel: payload.simpleLevel,
      style: payload.style
    });
    const user = buildAdvisorUserPrompt({
      contentType: payload.contentType,
      diagramSource: trimmedSource,
      visibleLabels: payload.visibleLabels,
      focusNode: payload.focusNode ?? (payload.focusNodeId ? { id: payload.focusNodeId } : null),
      lastSuggestions: payload.lastSuggestions,
      previousSuggestion: payload.previousSuggestion,
      mode: payload.mode,
      simpleLevel: payload.simpleLevel,
      style: payload.style
    });

    try {
      const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
      const raw = extractTextContent(reply?.content ?? reply);
      let parsedReply = parseAdvisorReply(raw, { persona: payload.persona });
      if (
        !parsedReply &&
        payload.mode === 'dumb' &&
        payload.style === 'gibberish' &&
        payload.persona === 'explain'
      ) {
        const seed =
          payload.focusNode?.label ||
          payload.focusNode?.clickedLabel ||
          payload.visibleLabels?.[0] ||
          payload.previousSuggestion ||
          '';
        parsedReply = {
          suggestion: fallbackLabelGibberish(seed),
          highlightIds: [],
          kind: 'comment'
        };
      }
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

  router.post('/explain', async (req, res) => {
    const parsed = ExplainLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid explain payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const target = (payload.partName || payload.label || '').trim();
    if (!target) {
      res.status(400).json({ error: 'Missing label to explain' });
      return;
    }

    try {
      const explanation = await explainLabelOnce({ payload });
      if (!explanation) {
        res.status(200).json({ explanation: null });
        return;
      }
      res.status(200).json({ explanation });
    } catch (error) {
      if (error?.name === 'LlmNotConfiguredError') {
        res.status(503).json({ error: safeErrorMessage(error) });
        return;
      }
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  });

  return router;
}
