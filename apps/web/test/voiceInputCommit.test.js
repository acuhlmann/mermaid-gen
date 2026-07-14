import { describe, expect, it } from 'vitest';
import {
  extractSpeechResultSnapshot,
  sliceInterimBeyondFinals,
  sliceNewSpeechText
} from '../src/utils/voiceInputCommit.js';

function mockResults(entries) {
  return entries.map(({ transcript, isFinal }) => ({
    isFinal,
    0: { transcript }
  }));
}

describe('voiceInputCommit', () => {
  it('concatenates final segments and keeps the latest interim', () => {
    const results = mockResults([
      { transcript: 'create', isFinal: true },
      { transcript: ' a flowchart', isFinal: true },
      { transcript: ' for auth', isFinal: false }
    ]);

    expect(extractSpeechResultSnapshot(results)).toEqual({
      finalsText: 'create a flowchart',
      interim: ' for auth'
    });
  });

  it('commits only the new suffix of cumulative finals', () => {
    expect(sliceNewSpeechText('create', 0)).toBe('create');
    expect(sliceNewSpeechText('create a flowchart', 'create'.length)).toBe('a flowchart');
    expect(sliceNewSpeechText('create', 'create'.length)).toBe('');
  });

  it('does not flush interim that duplicates committed finals', () => {
    expect(sliceInterimBeyondFinals('create', 'create')).toBe('');
    expect(sliceInterimBeyondFinals('create', 'create a flowchart')).toBe('a flowchart');
    expect(sliceInterimBeyondFinals('create a flowchart', 'create')).toBe('');
  });
});
