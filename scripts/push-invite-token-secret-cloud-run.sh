#!/usr/bin/env bash
# Create or rotate Secret Manager secret invite-token-secret and attach it to Cloud Run services.
# Generates a random value when INVITE_TOKEN_SECRET is unset (never commit the value).
#
# Example:
#   GCP_PROJECT_ID=mermaidgen REGION=us-central1 bash scripts/push-invite-token-secret-cloud-run.sh
#   INVITE_TOKEN_SECRET="$(openssl rand -base64 32)" bash scripts/push-invite-token-secret-cloud-run.sh
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or gcloud config set project …" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SECRET_NAME="${INVITE_TOKEN_SECRET_NAME:-invite-token-secret}"
SERVICES=(mermaid-gen-main)
OPENROUTER_SECRET="${OPENROUTER_SECRET_NAME:-openrouter-api-key}"
DEEPSEEK_SECRET="${DEEPSEEK_SECRET_NAME:-deepseek-api-key}"
VISITOR_BADGE_SECRET="${VISITOR_BADGE_SECRET_NAME:-visitor-badge-secrets}"

if [[ -z "${INVITE_TOKEN_SECRET:-}" ]]; then
  INVITE_TOKEN_SECRET="$(openssl rand -base64 32)"
  echo "Generated random INVITE_TOKEN_SECRET (${#INVITE_TOKEN_SECRET} chars)."
fi

gcloud services enable secretmanager.googleapis.com run.googleapis.com --project="${PROJECT_ID}"

if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${INVITE_TOKEN_SECRET}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
else
  echo -n "${INVITE_TOKEN_SECRET}" | gcloud secrets create "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
fi

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

for svc in "${SERVICES[@]}"; do
  if ! gcloud run services describe "${svc}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "Skip ${svc} (service not found)."
    continue
  fi
  SECRETS="INVITE_TOKEN_SECRET=${SECRET_NAME}:latest"
  if gcloud secrets describe "${OPENROUTER_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="OPENROUTER_API_KEY=${OPENROUTER_SECRET}:latest,${SECRETS}"
  fi
  if gcloud secrets describe "${DEEPSEEK_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="DEEPSEEK_API_KEY=${DEEPSEEK_SECRET}:latest,${SECRETS}"
  fi
  if gcloud secrets describe "${VISITOR_BADGE_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="${SECRETS},VISITOR_BADGE_SECRETS=${VISITOR_BADGE_SECRET}:latest"
  fi
  echo "Updating ${svc} …"
  gcloud run services update "${svc}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --set-secrets="${SECRETS}"
done

echo "Done. invite-token-secret is in Secret Manager; Cloud Run mounts INVITE_TOKEN_SECRET on next revision."
