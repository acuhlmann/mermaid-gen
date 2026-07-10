import test from 'node:test';
import assert from 'node:assert/strict';
import { ANYTHING_LIBS, ANYTHING_LIB_IDS } from '@archislop/shared';
import {
  ANYTHING_CORE_RULES,
  ANYTHING_SYSTEM_PROMPT
} from '../src/prompts/anythingSystemPrompt.js';
import { ANYTHING_DESIGN_GUIDE } from '../src/prompts/anythingDesignGuide.js';
import { ANYTHING_SELF_CHECK } from '../src/prompts/anythingSyntaxGuard.js';

// Drift guards: the prompts are generated from the shared lib registry, so a
// registry change (new lib, version bump) must show up in what agents are told
// — and the old "there are no libraries" phrasing must not resurface.

test('core rules advertise every allowlisted lib with marker syntax and version', () => {
  for (const lib of ANYTHING_LIBS) {
    assert.ok(
      ANYTHING_CORE_RULES.includes(`<!-- @lib:${lib.id} -->`),
      `missing marker for ${lib.id}`
    );
    assert.ok(ANYTHING_CORE_RULES.includes(`v${lib.version}`), `missing version for ${lib.id}`);
  }
  assert.ok(!/there are no libraries/i.test(ANYTHING_CORE_RULES));
  assert.ok(ANYTHING_SYSTEM_PROMPT.includes(ANYTHING_CORE_RULES));
});

test('self-check names the allowlisted lib ids', () => {
  for (const lib of ANYTHING_LIBS) {
    assert.ok(ANYTHING_SELF_CHECK.includes(lib.id), `self-check missing ${lib.id}`);
  }
});

test('design-guide library rules only reference allowlisted lib ids', () => {
  // The craft guidance is hand-written prose, not registry-generated: if a lib
  // is ever dropped from the registry, its when-to-use rule must go with it.
  const mentioned = [...ANYTHING_DESIGN_GUIDE.matchAll(/@lib:([a-z0-9_.-]+)/gi)].map((m) =>
    m[1].toLowerCase()
  );
  assert.ok(mentioned.length > 0, 'design guide should cover the libraries');
  for (const id of mentioned) {
    assert.ok(ANYTHING_LIB_IDS.includes(id), `design guide mentions unknown lib "${id}"`);
  }
});
