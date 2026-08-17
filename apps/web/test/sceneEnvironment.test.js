import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildGradientEquirect } from '../src/components/metaphorScenes/sceneUtils.js';

describe('buildGradientEquirect', () => {
  it('tags the IBL source as sRGB so themes do not wash out', () => {
    // Authored zenith/horizon/ground colours are sRGB hex values. Without
    // colorSpace the PMREM'd environment comes back desaturated — the same class
    // of bug shiftColor fixed for material tints.
    const texture = buildGradientEquirect('#258fce', '#c9e8f0', '#557a3d');
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
    texture.dispose();
  });

  it('interpolates zenith, horizon, and ground stops vertically', () => {
    const texture = buildGradientEquirect('#0000ff', '#00ff00', '#ff0000');
    const { data, width, height } = texture.image;
    const channelAt = (row, channel) => data[row * width * 4 + channel];
    const topRow = 0;
    const midRow = Math.floor(height / 2);
    const bottomRow = height - 1;

    expect(channelAt(topRow, 2)).toBeGreaterThan(channelAt(midRow, 2));
    expect(channelAt(midRow, 1)).toBeGreaterThan(channelAt(topRow, 1));
    expect(channelAt(bottomRow, 0)).toBeGreaterThan(channelAt(midRow, 0));
    texture.dispose();
  });
});
