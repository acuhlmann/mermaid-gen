import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendLanguageInstruction,
  appendProseLanguageInstruction,
  buildLanguageInstruction,
  buildProseLanguageInstruction,
  detectPromptLanguageHint,
  resolvePromptLanguageHint
} from '../src/promptLanguage.js';

describe('detectPromptLanguageHint', () => {
  it('detects Chinese from Han characters', () => {
    assert.equal(detectPromptLanguageHint('画一个用户登录流程图'), 'Chinese (zh)');
  });

  it('detects Japanese when kana is present', () => {
    assert.equal(detectPromptLanguageHint('ユーザー登録のフローを描いて'), 'Japanese (ja)');
  });

  it('detects Korean from Hangul', () => {
    assert.equal(detectPromptLanguageHint('사용자 로그인 흐름을 그려줘'), 'Korean (ko)');
  });

  it('returns null for Latin-only prompts', () => {
    assert.equal(detectPromptLanguageHint('draw a login flow'), null);
    assert.equal(detectPromptLanguageHint(''), null);
    assert.equal(detectPromptLanguageHint(null), null);
  });

  it('does not treat sparse Han in English as Chinese', () => {
    assert.equal(detectPromptLanguageHint('Use 微信 OAuth in the diagram'), null);
  });
});

describe('resolvePromptLanguageHint', () => {
  it('prefers the first source with a hint', () => {
    assert.equal(resolvePromptLanguageHint('draw login', '用户登录流程'), 'Chinese (zh)');
  });

  it('falls back to later sources', () => {
    assert.equal(resolvePromptLanguageHint('', null, '订单处理系统'), 'Chinese (zh)');
  });
});

describe('buildLanguageInstruction', () => {
  it('returns empty string when no CJK hint', () => {
    assert.equal(buildLanguageInstruction('hello world'), '');
  });

  it('embeds Chinese lock for Chinese prompts', () => {
    const block = buildLanguageInstruction('创建架构图');
    assert.match(block, /LANGUAGE LOCK/);
    assert.match(block, /Chinese \(zh\)/);
    assert.match(block, /NON-NEGOTIABLE/);
  });
});

describe('append helpers', () => {
  it('appendLanguageInstruction leaves Latin prompts unchanged', () => {
    assert.equal(appendLanguageInstruction('base', 'hello'), 'base');
  });

  it('appendProseLanguageInstruction appends for Chinese diagram labels', () => {
    const out = appendProseLanguageInstruction('Explain this.', null, '用户服务 → 订单服务');
    assert.match(out, /Chinese \(zh\)/);
    assert.match(buildProseLanguageInstruction('用户服务'), /section headings/);
  });
});
