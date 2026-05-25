import { z } from 'zod';

export const CHART_THEMES = ['whiteboard', 'noir', 'arcade', 'blueprint'] as const;
export const ChartThemeSchema = z.enum(CHART_THEMES).default('whiteboard');

/**
 * Raw Vega-Lite spec. Validated here only as "a non-empty object" — full schema
 * validation happens via vega-lite's `compile()` in `apps/server/src/tools/chartDslTool.js`.
 * Keeping the inner spec loosely typed in shared lets us interop with the published
 * Vega-Lite types without baking them into our wire contract.
 */
export const VegaLiteSpecSchema = z.record(z.string(), z.unknown());

export const ChartDslSchema = z.object({
  archislopVersion: z.literal(1).default(1),
  theme: ChartThemeSchema,
  spec: VegaLiteSpecSchema
});

export type ChartTheme = z.infer<typeof ChartThemeSchema>;
export type VegaLiteSpec = z.infer<typeof VegaLiteSpecSchema>;
export type ChartDsl = z.infer<typeof ChartDslSchema>;

export interface ParseChartDslSuccess {
  ok: true;
  dsl: ChartDsl;
  text: string;
}

export interface ParseChartDslFailure {
  ok: false;
  error: string;
}

export type ParseChartDslResult = ParseChartDslSuccess | ParseChartDslFailure;

function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Parse a chart DSL JSON string into a validated wrapper. Does not call vega-lite/compile —
 * that is the next ladder layer and lives in the server tool. Use this for shared validation
 * (state-store apply, web preview, tests).
 */
export function parseChartDsl(source: unknown): ParseChartDslResult {
  if (typeof source !== 'string') {
    return { ok: false, error: 'Chart DSL must be a JSON string.' };
  }
  const text = stripJsonCodeFence(source);
  if (!text) {
    return { ok: false, error: 'Chart DSL was empty.' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: `Chart DSL is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  const parsed = ChartDslSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `Chart DSL did not match wrapper schema: ${message}` };
  }

  if (Object.keys(parsed.data.spec).length === 0) {
    return { ok: false, error: 'Chart DSL "spec" must be a non-empty Vega-Lite object.' };
  }

  return { ok: true, dsl: parsed.data, text: JSON.stringify(parsed.data) };
}
