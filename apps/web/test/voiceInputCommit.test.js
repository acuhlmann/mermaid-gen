import { describe, expect, it } from 'vitest';
import {
  buildSessionTranscript,
  collapseRepeatedSpeechTokens,
  combinePromptWithVoiceSession,
  extractSpeechResultSnapshot,
  mergeSpeechTranscript,
  sliceInterimBeyondFinals,
  sliceNewSpeechText,
  speechRecognitionLangForUiLocale
} from '../src/utils/voiceInputCommit.js';

function mockResults(entries) {
  return entries.map(({ transcript, isFinal }) => ({
    isFinal,
    0: { transcript }
  }));
}

describe('voiceInputCommit', () => {
  it('maps UI locales to SpeechRecognition language tags', () => {
    expect(speechRecognitionLangForUiLocale('en')).toBe('en-US');
    expect(speechRecognitionLangForUiLocale('en-AU')).toBe('en-AU');
    expect(speechRecognitionLangForUiLocale('zh-CN')).toBe('zh-CN');
    expect(speechRecognitionLangForUiLocale('zh-TW')).toBe('zh-TW');
    expect(speechRecognitionLangForUiLocale('unknown')).toBe('en-US');
  });

  it('collapses consecutive repeated tokens', () => {
    expect(collapseRepeatedSpeechTokens('create create a flowchart')).toBe('create a flowchart');
    expect(collapseRepeatedSpeechTokens('Hello hello world')).toBe('Hello world');
    expect(collapseRepeatedSpeechTokens('的的流程图')).toBe('的流程图');
  });

  it('merges overlapping segment boundaries without stutter', () => {
    expect(mergeSpeechTranscript('create a flowchart', 'flowchart for auth')).toBe(
      'create a flowchart for auth'
    );
    expect(mergeSpeechTranscript('draw a sequence', 'sequence diagram')).toBe(
      'draw a sequence diagram'
    );
    expect(mergeSpeechTranscript('hello world', 'world')).toBe('hello world');
    expect(mergeSpeechTranscript('微服务架构', '架构图')).toBe('微服务架构图');
  });

  it('builds a session transcript that absorbs interim revisions', () => {
    const results = mockResults([
      { transcript: 'create', isFinal: true },
      { transcript: ' a flowchart', isFinal: true },
      { transcript: ' for auth', isFinal: false }
    ]);

    expect(buildSessionTranscript(results)).toEqual({
      finalsText: 'create a flowchart',
      interim: 'for auth',
      sessionText: 'create a flowchart for auth'
    });

    expect(extractSpeechResultSnapshot(results)).toEqual({
      finalsText: 'create a flowchart',
      interim: 'for auth'
    });
  });

  it('dedupes Chrome final segments that repeat the prior trailing word', () => {
    const results = mockResults([
      { transcript: 'create a diagram', isFinal: true },
      { transcript: ' diagram for login', isFinal: true },
      { transcript: ' for login flow', isFinal: false }
    ]);

    expect(buildSessionTranscript(results).sessionText).toBe('create a diagram for login flow');
    expect(buildSessionTranscript(results, { includeInterim: false }).sessionText).toBe(
      'create a diagram for login'
    );
  });

  it('combines the pre-dictation prompt with the live session text', () => {
    expect(combinePromptWithVoiceSession('', 'create a flowchart')).toBe('create a flowchart');
    expect(combinePromptWithVoiceSession('Please', 'create a flowchart')).toBe(
      'Please create a flowchart'
    );
    expect(combinePromptWithVoiceSession('Please ', '')).toBe('Please');
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
    expect(sliceInterimBeyondFinals('create a flow', 'create a flowchart')).toBe('chart');
  });
});
