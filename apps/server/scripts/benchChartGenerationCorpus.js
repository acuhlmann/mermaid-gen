/**
 * Prompt corpus for benchChartGeneration.js.
 *
 * These are user PROMPTS, not specs — the bench sends each through the real chart agent
 * (benchChart.js is the one that replays hand-written specs through the gate). Families
 * cover the chart shapes chart mode is meant for, plus two that stress transcription and
 * language, because those are where an authoring format can quietly lose the user's data.
 *
 * Keep prompts SHORT and in the register a user actually types.
 */

/**
 * @typedef {object} ChartGenerationCase
 * @property {string} id
 * @property {string} family
 * @property {string} prompt
 */

/** @type {ChartGenerationCase[]} */
export const CHART_GENERATION_CORPUS = [
  {
    id: 'bar-ranking',
    family: 'comparison',
    prompt: 'Top 8 programming languages by GitHub pull requests last year'
  },
  {
    id: 'grouped-bar',
    family: 'comparison',
    prompt: 'Compare iOS vs Android market share in 6 regions'
  },
  {
    id: 'line-multi',
    family: 'trend',
    prompt: 'Monthly active users for three competing chat apps over 2024'
  },
  {
    id: 'area-stacked',
    family: 'trend',
    prompt: 'How the US electricity mix shifted from coal to renewables since 2005'
  },
  {
    id: 'scatter',
    family: 'relationship',
    prompt: 'Do countries with higher GDP per capita have higher life expectancy?'
  },
  { id: 'heatmap', family: 'density', prompt: 'Support tickets by weekday and hour of day' },
  {
    id: 'pie-share',
    family: 'share',
    prompt: 'Where my monthly budget goes: rent, food, transport, fun, savings'
  },
  {
    id: 'histogram',
    family: 'distribution',
    prompt: 'Distribution of API response times in milliseconds'
  },
  {
    id: 'percent-change',
    family: 'comparison',
    prompt: 'Year-over-year revenue growth % by product line, some negative'
  },
  {
    id: 'timeseries-dates',
    family: 'trend',
    prompt: 'Daily signups for the 30 days around our launch on March 14'
  },
  {
    id: 'transcribe',
    family: 'transcription',
    prompt:
      'Chart this exactly: Q1 2025 revenue 4.2M, Q2 5.1M, Q3 4.8M, Q4 6.3M; costs Q1 3.9M, Q2 4.0M, Q3 4.4M, Q4 4.6M'
  },
  {
    id: 'german',
    family: 'language',
    prompt: 'Zeig mir die Stromkosten pro Monat für 2024 in Euro'
  }
];
