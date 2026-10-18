/**
 * @param {File} file
 */
export function fileSummaryFromFile(file) {
  if (!file || typeof file !== 'object') return [];
  const rows = [
    { label: 'Name', value: file.name || '—' },
    { label: 'Type', value: file.type || '—' },
    { label: 'Size', value: formatByteCount(file.size) },
    { label: 'Modified', value: formatFileModified(file.lastModified) }
  ];
  return rows;
}

/**
 * @param {HTMLVideoElement | null} video
 * @param {File | null} file
 */
export function videoSummaryFromElement(video, file) {
  const rows = file ? fileSummaryFromFile(file) : [];
  if (!video) return rows;

  const duration = Number.isFinite(video.duration) ? video.duration : null;
  const w = video.videoWidth;
  const h = video.videoHeight;

  if (duration != null && duration > 0) {
    rows.push({ label: 'Duration', value: formatDurationSeconds(duration) });
  }
  if (w > 0 && h > 0) {
    rows.push({ label: 'Dimensions', value: `${w} × ${h}` });
  }
  if (video.readyState >= 1) {
    rows.push({ label: 'Ready state', value: String(video.readyState) });
  }
  return rows;
}

/**
 * @param {HTMLImageElement | null} img
 * @param {File | null} file
 */
export function imageSummaryFromElement(img, file) {
  const rows = file ? fileSummaryFromFile(file) : [];
  if (!img) return rows;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w > 0 && h > 0) {
    rows.push({ label: 'Dimensions', value: `${w} × ${h}` });
  }
  return rows;
}

export function formatByteCount(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function formatDurationSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function formatFileModified(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

export function isVideoFile(file) {
  const type = (file?.type ?? '').toLowerCase();
  if (type.startsWith('video/')) return true;
  const name = (file?.name ?? '').toLowerCase();
  return name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov');
}

export function isImageFile(file) {
  const type = (file?.type ?? '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const name = (file?.name ?? '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|svg)$/.test(name);
}
