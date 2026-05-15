import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePublicBaseUrl } from '../src/utils/publicBaseUrl.js';

test('resolvePublicBaseUrl prefers PUBLIC_BASE_URL', () => {
  const prev = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://mermaid-gen-main-464241135431.us-central1.run.app';
  try {
    assert.equal(
      resolvePublicBaseUrl(null),
      'https://mermaid-gen-main-464241135431.us-central1.run.app'
    );
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prev;
  }
});

test('resolvePublicBaseUrl uses forwarded proto and host for non-local requests', () => {
  const prev = process.env.PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  try {
    const req = {
      secure: false,
      protocol: 'http',
      get(name) {
        if (name === 'host') return 'mermaid-gen-main-464241135431.us-central1.run.app';
        if (name === 'x-forwarded-proto') return 'https';
        return undefined;
      }
    };
    assert.equal(
      resolvePublicBaseUrl(req),
      'https://mermaid-gen-main-464241135431.us-central1.run.app'
    );
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prev;
  }
});
