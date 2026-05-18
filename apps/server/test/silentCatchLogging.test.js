import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdvisorReply } from '../src/agents/advisorPrompts.js';

test('parseAdvisorReply logs a warning when JSON parse fails on a brace-matched payload', () => {
  const original = console.warn;
  const calls = [];
  console.warn = (...args) => {
    calls.push(args);
  };
  try {
    const result = parseAdvisorReply('here is the reply: {suggestion: not valid json}');
    assert.equal(result, null);
    assert.equal(calls.length, 1);
    assert.match(String(calls[0][0]), /advisorPrompts: advisor reply JSON parse failed/);
  } finally {
    console.warn = original;
  }
});

test('parseAdvisorReply does not log when input has no JSON-like substring', () => {
  const original = console.warn;
  const calls = [];
  console.warn = (...args) => {
    calls.push(args);
  };
  try {
    parseAdvisorReply('no braces here');
    parseAdvisorReply('');
    assert.equal(calls.length, 0);
  } finally {
    console.warn = original;
  }
});
