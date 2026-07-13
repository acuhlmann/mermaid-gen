/**
 * Resolve Auto (`contentType: 'auto'`) to a concrete slot before agent dispatch.
 * Intent/Go only — transform/analyze never accept auto on the wire.
 */

import {
  AUTO_CONTENT_TYPE,
  createLegacyContentTypeStreamEvent,
  type ContentType,
  type LegacyStreamEvent
} from '@archislop/shared';
import { inferContentTypeFromPrompt } from '../agents/inferContentType.js';

export type ResolvedSlotState = {
  revisionId: number;
  diagramSource: string;
  contentType?: string;
  [key: string]: unknown;
};

/**
 * When the client sends Auto, classify the prompt and adopt the target slot's
 * server-side revision/source (client placeholders are not meaningful for Auto).
 */
export async function resolveAutoIntentContentType<T extends {
  contentType: string;
  prompt: string;
  revisionId: number;
  diagramSource: string;
}>({
  payload,
  getSlot,
  env = process.env,
  abortSignal,
  onResolved
}: {
  payload: T;
  getSlot: (contentType: ContentType) => ResolvedSlotState;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
  onResolved?: (evt: LegacyStreamEvent) => void;
}): Promise<T & { contentType: ContentType }> {
  if (payload.contentType !== AUTO_CONTENT_TYPE) {
    return payload as T & { contentType: ContentType };
  }

  const { contentType, reason } = await inferContentTypeFromPrompt({
    prompt: payload.prompt,
    contentType: AUTO_CONTENT_TYPE,
    env,
    abortSignal
  });

  onResolved?.(createLegacyContentTypeStreamEvent({ contentType, reason }));

  const slot = getSlot(contentType);
  return {
    ...payload,
    contentType,
    revisionId: slot.revisionId,
    diagramSource: typeof slot.diagramSource === 'string' ? slot.diagramSource : ''
  };
}
