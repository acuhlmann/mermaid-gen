/**
 * Deterministic process.env slices for route tests.
 * Cloud VMs often load API keys from .env — pass these to routers instead of
 * relying on ambient process.env so tests stay key-agnostic.
 */
export const UNCONFIGURED_LLM_ENV = {
  LLM_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: '',
  DEEPSEEK_API_KEY: '',
  GOOGLE_CLOUD_PROJECT: '',
  GCLOUD_PROJECT: '',
  VERTEX_PROJECT_ID: '',
  VERTEX_LOCATION: ''
};
