/**
 * ArchiSlop God's synthetic probe corpus (ADR-0019).
 *
 * Fixed prompts, written here and nowhere else, sent through the real agents by `probe.mjs` when
 * production traffic is too thin to judge a slot. Two per slot: enough to pool into a sample over a
 * week of daily probes, few enough that one run stays inside `PROBE_MAX_USD`.
 *
 * Change this list deliberately. Pooling assumes the corpus is stable — swapping prompts mid-week
 * mixes two measurements into one number. Each prompt is an ordinary first ask from an empty canvas,
 * the commonest real turn, and none leans on a feature a slot does not have.
 */
import { ContentTypeSchema } from '@archislop/shared';

/** @type {ReadonlyArray<{ id: string, contentType: string, prompt: string }>} */
export const PROBE_CORPUS = Object.freeze([
  {
    id: 'mermaid.login-flow',
    contentType: 'mermaid',
    prompt: 'A flowchart of a user logging in with a password, including the locked-account path.'
  },
  {
    id: 'mermaid.checkout-sequence',
    contentType: 'mermaid',
    prompt: 'A sequence diagram of a web checkout: browser, API, payment provider and database.'
  },
  {
    id: 'infographic.cloud-costs',
    contentType: 'infographic',
    prompt: 'An infographic summarising where a startup spends its cloud budget, with three KPIs.'
  },
  {
    id: 'infographic.onboarding-steps',
    contentType: 'infographic',
    prompt: 'A five-step infographic of how a new engineer gets productive in their first month.'
  },
  {
    id: 'chart.quarterly-revenue',
    contentType: 'chart',
    prompt: 'A bar chart of quarterly revenue for two product lines over the last two years.'
  },
  {
    id: 'chart.latency-trend',
    contentType: 'chart',
    prompt: 'A line chart of p50 and p95 API latency over thirty days, with one visible regression.'
  },
  {
    id: 'forms.vendor-intake',
    contentType: 'forms',
    prompt: 'An intake form for onboarding a new software vendor at a large company.'
  },
  {
    id: 'forms.access-request',
    contentType: 'forms',
    prompt: 'A form for requesting production database access, with a business justification.'
  },
  {
    id: 'anything.tides-explainer',
    contentType: 'anything',
    prompt: 'Explain how tides work, as a nicely typeset one-page explainer.'
  },
  {
    id: 'anything.pomodoro',
    contentType: 'anything',
    prompt: 'A working pomodoro timer with start, pause and reset buttons.'
  },
  {
    id: 'metaphor3d.microservices',
    contentType: 'metaphor3d',
    prompt: 'Show a microservices architecture with a gateway, five services and a shared queue.'
  },
  {
    id: 'metaphor3d.data-pipeline',
    contentType: 'metaphor3d',
    prompt: 'Show a data pipeline from ingestion through cleaning and storage to dashboards.'
  }
]);

for (const entry of PROBE_CORPUS) ContentTypeSchema.parse(entry.contentType);
