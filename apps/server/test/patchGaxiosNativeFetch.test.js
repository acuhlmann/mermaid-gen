import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { Gaxios, instance as gaxiosInstance } from 'gaxios';
import { patchGaxiosNativeFetch } from '../src/config/patchGaxiosNativeFetch.js';

test('patchGaxiosNativeFetch wires Gaxios to native fetch on Node', () => {
  patchGaxiosNativeFetch();
  assert.equal(typeof globalThis.window?.fetch, 'function');
  assert.equal(typeof gaxiosInstance.defaults.fetchImplementation, 'function');
});

test('patchGaxiosNativeFetch survives jsdom replacing globalThis.window', async () => {
  patchGaxiosNativeFetch();

  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  assert.equal(typeof dom.window.fetch, 'undefined');

  patchGaxiosNativeFetch();
  assert.equal(typeof globalThis.window.fetch, 'function');

  const client = new Gaxios();

  try {
    await client.request({
      url: 'https://www.googleapis.com/oauth2/v4/token',
      method: 'POST',
      data: {}
    });
  } catch (error) {
    assert.notEqual(error.message, 'fetchImpl is not a function');
  }
});
