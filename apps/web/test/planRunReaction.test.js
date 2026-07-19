import { describe, expect, it } from 'vitest';
import {
  planRunReaction,
  RUN_REACTION_COOLDOWN_MS,
  RUN_REACTION_SESSION_CAP,
  RUN_REACTION_LLM_CAP
} from '../src/hooks/useOfficeRunReactions.js';

const base = {
  now: 1_000_000,
  lastReactionAt: 0,
  reactionCount: 0,
  llmCount: 0,
  hasDiagram: true,
  random: () => 0 // always under the chance gate
};

describe('planRunReaction', () => {
  it('reacts (canned) to a fresh run when everything is clear', () => {
    // random()=0 passes the chance gate but 0 < LLM share, so it also opts into LLM.
    expect(planRunReaction(base)).toEqual({ kind: 'im', useLlm: true });
  });

  it('stays canned once the LLM budget is spent', () => {
    const plan = planRunReaction({ ...base, llmCount: RUN_REACTION_LLM_CAP });
    expect(plan).toEqual({ kind: 'im', useLlm: false });
  });

  it('stays silent on a blank canvas — nothing to react to', () => {
    expect(planRunReaction({ ...base, hasDiagram: false })).toBeNull();
  });

  it('respects the per-session cap', () => {
    expect(planRunReaction({ ...base, reactionCount: RUN_REACTION_SESSION_CAP })).toBeNull();
  });

  it('respects the cooldown between reactions', () => {
    expect(
      planRunReaction({ ...base, lastReactionAt: base.now - (RUN_REACTION_COOLDOWN_MS - 1) })
    ).toBeNull();
    // Just past the cooldown, it fires again.
    expect(
      planRunReaction({ ...base, lastReactionAt: base.now - RUN_REACTION_COOLDOWN_MS })
    ).not.toBeNull();
  });

  it('most runs land quietly (chance gate)', () => {
    // random() above the chance threshold suppresses the reaction.
    expect(planRunReaction({ ...base, random: () => 0.99 })).toBeNull();
  });
});
