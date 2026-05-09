import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COAUTHOR_PROFILE_DEFAULTS,
  INTENT_PROFILE_DEFAULTS,
  toLangChainMessages
} from '../src/agents/mermaidLangChainAgent.js';

test('agent message conversion drops assistant replies that expose internal tool names', () => {
  const messages = toLangChainMessages([
    {
      role: 'assistant',
      content: 'Please call get_diagram_state before I can help.'
    },
    {
      role: 'user',
      content: 'simplify it'
    }
  ]);

  assert.deepEqual(messages, [
    {
      role: 'user',
      content: 'simplify it'
    }
  ]);
});

test('intent and co-author defaults use distinct profiles', () => {
  assert.notDeepEqual(INTENT_PROFILE_DEFAULTS, COAUTHOR_PROFILE_DEFAULTS);
  assert.equal(INTENT_PROFILE_DEFAULTS.styleGuide, 'balanced');
  assert.equal(COAUTHOR_PROFILE_DEFAULTS.styleGuide, 'bold');
  assert.ok(COAUTHOR_PROFILE_DEFAULTS.maxNodes > INTENT_PROFILE_DEFAULTS.maxNodes);
  assert.ok(COAUTHOR_PROFILE_DEFAULTS.temperature > INTENT_PROFILE_DEFAULTS.temperature);
});
