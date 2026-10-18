import { describe, expect, it } from 'vitest';
import {
  fileSummaryFromFile,
  formatByteCount,
  formatDurationSeconds,
  isVideoFile
} from '../src/features/mediaViewer/mediaMetadata.js';

describe('mediaMetadata', () => {
  it('formats bytes and duration', () => {
    expect(formatByteCount(500)).toBe('500 B');
    expect(formatByteCount(2048)).toBe('2.0 KB');
    expect(formatDurationSeconds(65)).toBe('1:05');
    expect(formatDurationSeconds(3661)).toBe('1:01:01');
  });

  it('builds file summary rows', () => {
    const file = new File(['x'], 'clip.mp4', {
      type: 'video/mp4',
      lastModified: 1_700_000_000_000
    });
    const rows = fileSummaryFromFile(file);
    expect(rows.some((r) => r.label === 'Name' && r.value === 'clip.mp4')).toBe(true);
    expect(rows.some((r) => r.label === 'Type' && r.value === 'video/mp4')).toBe(true);
  });

  it('detects video by extension', () => {
    const file = new File([], 'walkthrough.MP4', { type: '' });
    expect(isVideoFile(file)).toBe(true);
  });
});
