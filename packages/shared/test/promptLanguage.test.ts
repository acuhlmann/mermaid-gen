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
  it('detects simplified Chinese from Han characters', () => {
    assert.equal(detectPromptLanguageHint('画一个用户登录流程图'), 'Simplified Chinese (zh-CN)');
    assert.equal(
      detectPromptLanguageHint('创建架构图说明网络与数据库'),
      'Simplified Chinese (zh-CN)'
    );
  });

  it('detects traditional Chinese from traditional markers', () => {
    assert.equal(
      detectPromptLanguageHint('畫一個用戶登入流程圖並說明網路與資料庫'),
      'Traditional Chinese (zh-TW)'
    );
  });

  it('returns neutral Chinese when variant markers tie', () => {
    assert.equal(detectPromptLanguageHint('画图流程'), 'Chinese (zh)');
  });

  it('returns null for Latin-only prompts', () => {
    assert.equal(detectPromptLanguageHint('draw a login flow'), null);
    assert.equal(detectPromptLanguageHint(''), null);
    assert.equal(detectPromptLanguageHint(null), null);
  });

  it('does not treat sparse Han in English as Chinese', () => {
    assert.equal(detectPromptLanguageHint('Use 微信 OAuth in the diagram'), null);
  });

  it('does not special-case Japanese or Korean (no extra lock)', () => {
    assert.equal(detectPromptLanguageHint('ユーザー登録のフローを描いて'), null);
    assert.equal(detectPromptLanguageHint('사용자 로그인 흐름을 그려줘'), null);
  });
});

describe('resolvePromptLanguageHint', () => {
  it('prefers the first source with a hint', () => {
    assert.equal(
      resolvePromptLanguageHint('draw login', '用户登录流程'),
      'Simplified Chinese (zh-CN)'
    );
  });

  it('falls back to later sources', () => {
    assert.equal(
      resolvePromptLanguageHint('', null, '訂單處理系統架構'),
      'Traditional Chinese (zh-TW)'
    );
  });
});

describe('buildLanguageInstruction', () => {
  it('returns empty string when no Chinese hint', () => {
    assert.equal(buildLanguageInstruction('hello world'), '');
  });

  it('embeds simplified Chinese lock for simplified prompts', () => {
    const block = buildLanguageInstruction('创建架构图');
    assert.match(block, /LANGUAGE LOCK/);
    assert.match(block, /Simplified Chinese \(zh-CN\)/);
    assert.match(block, /simplified and traditional/);
    assert.match(block, /NON-NEGOTIABLE/);
  });

  it('embeds traditional Chinese lock for traditional prompts', () => {
    const block = buildLanguageInstruction('建立系統架構圖與網路說明');
    assert.match(block, /Traditional Chinese \(zh-TW\)/);
  });
});

describe('append helpers', () => {
  it('appendLanguageInstruction leaves Latin prompts unchanged', () => {
    assert.equal(appendLanguageInstruction('base', 'hello'), 'base');
  });

  it('appendProseLanguageInstruction appends for Chinese diagram labels', () => {
    const out = appendProseLanguageInstruction('Explain this.', null, '用户服务 → 订单服务');
    assert.match(out, /Simplified Chinese \(zh-CN\)/);
    assert.match(buildProseLanguageInstruction('用户服务'), /section headings/);
  });
});
