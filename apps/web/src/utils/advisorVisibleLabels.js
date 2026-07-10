import { parseChartDsl } from '@archislop/shared';
import { getVisibleDiagramLabels } from './visibleDiagramLabels.js';
import { getVisibleInfographicLabels } from './visibleInfographicLabels.js';

const MAX_LABELS = 30;
const MAX_LABEL_CHARS = 160;

function pushUnique(list, seen, value) {
  const label = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!label || seen.has(label)) return;
  seen.add(label);
  list.push(label.slice(0, MAX_LABEL_CHARS));
}

function chartTitleText(title) {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object' && typeof title.text === 'string') return title.text;
  return '';
}

function collectEncodingLabels(encoding, labels, seen) {
  if (!encoding || typeof encoding !== 'object') return;
  for (const channel of Object.values(encoding)) {
    if (!channel || typeof channel !== 'object') continue;
    pushUnique(labels, seen, channel.title);
    pushUnique(labels, seen, channel.field);
  }
}

export function extractChartAdvisorLabels(source) {
  const parsed = parseChartDsl(source);
  if (!parsed.ok) return { labels: [], ids: [] };
  const spec = parsed.dsl.spec ?? {};
  const labels = [];
  const seen = new Set();
  pushUnique(labels, seen, chartTitleText(spec.title));
  pushUnique(labels, seen, spec.description);
  collectEncodingLabels(spec.encoding, labels, seen);
  const values = spec.data && typeof spec.data === 'object' ? spec.data.values : null;
  if (Array.isArray(values)) {
    for (const row of values) {
      if (!row || typeof row !== 'object') continue;
      for (const value of Object.values(row)) {
        if (labels.length >= MAX_LABELS) break;
        if (typeof value === 'string') pushUnique(labels, seen, value);
      }
      if (labels.length >= MAX_LABELS) break;
    }
  }
  return { labels: labels.slice(0, MAX_LABELS), ids: labels.slice(0, MAX_LABELS) };
}

export function extractAnythingAdvisorLabels(source) {
  if (typeof DOMParser === 'undefined' || typeof source !== 'string' || !source.trim()) {
    return { labels: [], ids: [] };
  }
  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('script, style, template, noscript').forEach((el) => el.remove());
  const labels = [];
  const seen = new Set();
  const selectors = [
    'h1',
    'h2',
    'h3',
    'button',
    'label',
    'summary',
    'figcaption',
    '[aria-label]',
    '[title]'
  ];
  for (const el of doc.querySelectorAll(selectors.join(','))) {
    if (labels.length >= MAX_LABELS) break;
    pushUnique(
      labels,
      seen,
      el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent
    );
  }
  if (labels.length === 0 && doc.body?.textContent) {
    for (const chunk of doc.body.textContent.split(/[.!?\n]/)) {
      if (labels.length >= MAX_LABELS) break;
      pushUnique(labels, seen, chunk);
    }
  }
  return { labels: labels.slice(0, MAX_LABELS), ids: labels.slice(0, MAX_LABELS) };
}

export function getAdvisorVisibleLabels({ contentType, host, diagramSource }) {
  if (contentType === 'infographic') return getVisibleInfographicLabels(host);
  if (contentType === 'chart') return extractChartAdvisorLabels(diagramSource);
  if (contentType === 'anything') return extractAnythingAdvisorLabels(diagramSource);
  return getVisibleDiagramLabels(host);
}
