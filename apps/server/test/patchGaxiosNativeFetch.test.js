import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { instance as gaxiosInstance } from 'gaxios';
import { patchGaxiosNativeFetch } from '../src/config/patchGaxiosNativeFetch.js';

const originalWindow = globalThis.window;
const originalFetchImpl = gaxiosInstance.defaults.fetchImplementation;

beforeEach(() => {
  delete globalThis.window;
  delete gaxiosInstance.defaults.fetchImplementation;
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
  if (originalFetchImpl === undefined) {
    delete gaxiosInstance.defaults.fetchImplementation;
  } else {
    gaxiosInstance.defaults.fetchImplementation = originalFetchImpl;
  }
});

test('patchGaxiosNativeFetch wires Gaxios to native fetch on Node', () => {
  patchGaxiosNativeFetch();
  assert.equal(typeof globalThis.window?.fetch, 'function');
  assert.equal(typeof gaxiosInstance.defaults.fetchImplementation, 'function');
});
