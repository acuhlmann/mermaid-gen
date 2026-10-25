// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetChartRendererForTests,
  getChartRenderer,
  isChartRenderer,
  setChartRenderer,
  subscribe
} from '../src/state/chartRendererStore.js';
import { dataUrlToBlob } from '../src/utils/viewportPngExport.js';

afterEach(() => {
  _resetChartRendererForTests();
  window.localStorage.clear();
});

describe('chartRendererStore', () => {
  it('defaults to Vega-Lite and persists a valid pick', () => {
    expect(getChartRenderer()).toBe('vegalite');
    const listener = vi.fn();
    subscribe(listener);
    setChartRenderer('plotly');
    expect(getChartRenderer()).toBe('plotly');
    expect(window.localStorage.getItem('archislop.chartRenderer')).toBe('plotly');
    expect(listener).toHaveBeenCalledTimes(1);
    setChartRenderer('plotly');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown renderer', () => {
    setChartRenderer(/** @type {any} */ ('d3'));
    expect(getChartRenderer()).toBe('vegalite');
    expect(isChartRenderer('echarts')).toBe(true);
    expect(isChartRenderer('d3')).toBe(false);
  });
});

describe('dataUrlToBlob', () => {
  it('decodes base64 and plain data URLs without fetch', async () => {
    const png = dataUrlToBlob('data:image/png;base64,iVBORw0K');
    expect(png.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await png.arrayBuffer())).slice(0, 4)).toEqual([
      0x89, 0x50, 0x4e, 0x47
    ]);
    const text = dataUrlToBlob('data:text/plain,hello%20world');
    expect(await text.text()).toBe('hello world');
    expect(() => dataUrlToBlob('https://example.com/x.png')).toThrow(/data URL/);
  });
});
