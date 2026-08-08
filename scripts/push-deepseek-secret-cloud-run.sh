#!/usr/bin/env bash
# Create or rotate Secret Manager secret deepseek-api-key and attach it to Cloud Run services.
# Uses DEEPSEEK_API_KEY from the environment (never commit .env).
#
# With Vertex also configured (default on Cloud Run), Brain Quality routes to DeepSeek V4 Pro
# while Brain Fast stays on Vertex Gemini Flash — see docs/llm-config.md.
#
# Example:
#   export DEEPSEEK_API_KEY=sk-...
#   GCP_PROJECT_ID=mermaidgen REGION=us-central1 bash scripts/push-deepseek-secret-cloud-run.sh
set -euo pipefail

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "Set DEEPSEEK_API_KEY (e.g. export DEEPSEEK_API_KEY=... from your .env)." >&2
  exit 1
fi

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or gcloud config set project …" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SECRET_NAME="${DEEPSEEK_SECRET_NAME:-deepseek-api-key}"
SERVICES=(mermaid-gen-main)

gcloud services enable secretmanager.googleapis.com run.googleapis.com --project="${PROJECT_ID}"

if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${DEEPSEEK_API_KEY}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
else
  echo -n "${DEEPSEEK_API_KEY}" | gcloud secrets create "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
fi

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

for svc in "${SERVICES[@]}"; do
  if gcloud run services describe "${svc}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "Updating ${svc} …"
    gcloud run services update "${svc}" \
      --project="${PROJECT_ID}" \
      --region="${REGION}" \
      --update-secrets="DEEPSEEK_API_KEY=${SECRET_NAME}:latest"
  else
    echo "Skip ${svc} (service not found)."
  fi
done

echo "Done. Brain Quality will use deepseek-v4-pro when Vertex is also configured (hybrid auto mode)."
