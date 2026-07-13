import { describe, expect, it } from 'vitest';
import {
  extractFencedCodeBlock,
  extractFirstFencedBlockFromText
} from '../src/utils/thinkingFencedBlock';

describe('extractFencedCodeBlock', () => {
  it('extracts a closed json fence', () => {
    const lines = ['Intro', '```json', '{', '  "a": 1', '}', '```', 'Tail'];
    const block = extractFencedCodeBlock(lines, 1);
    expect(block).not.toBeNull();
    expect(block?.language).toBe('json');
    expect(block?.code).toBe('{\n  "a": 1\n}');
    expect(block?.nextIndex).toBe(6);
  });

  it('returns an unclosed fence through end-of-input for streaming', () => {
    const lines = ['```json', '{', '  "archislopVersion": 1'];
    const block = extractFencedCodeBlock(lines, 0);
    expect(block?.code).toContain('archislopVersion');
    expect(block?.nextIndex).toBe(3);
  });
});

describe('extractFirstFencedBlockFromText', () => {
  it('returns prose before and after a fenced block', () => {
    const text = `Before\n\n\`\`\`json\n{"a":1}\n\`\`\`\n\nAfter`;
    const block = extractFirstFencedBlockFromText(text);
    expect(block?.language).toBe('json');
    expect(block?.code).toBe('{"a":1}');
    expect(block?.prose).toBe('Before\n\nAfter');
  });
});
