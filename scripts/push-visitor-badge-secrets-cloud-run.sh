#!/usr/bin/env bash
# Create or rotate Secret Manager secret visitor-badge-secrets and attach it to Cloud Run services.
# Requires VISITOR_BADGE_SECRETS (plaintext door code(s), comma-separated). Never commit the value.
#
# Example:
#   VISITOR_BADGE_SECRETS='coffee-is-for-closers' \
#     GCP_PROJECT_ID=mermaidgen REGION=us-central1 \
#     bash scripts/push-visitor-badge-secrets-cloud-run.sh
# Secret Manager only (no Cloud Run revision):
#   SKIP_CLOUD_RUN_UPDATE=1 VISITOR_BADGE_SECRETS='…' bash scripts/push-visitor-badge-secrets-cloud-run.sh
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or gcloud config set project …" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SECRET_NAME="${VISITOR_BADGE_SECRET_NAME:-visitor-badge-secrets}"
SERVICES=(mermaid-gen-main mermaid-gen-hackathon)
OPENROUTER_SECRET="${OPENROUTER_SECRET_NAME:-openrouter-api-key}"
DEEPSEEK_SECRET="${DEEPSEEK_SECRET_NAME:-deepseek-api-key}"
INVITE_SECRET="${INVITE_TOKEN_SECRET_NAME:-invite-token-secret}"

if [[ -z "${VISITOR_BADGE_SECRETS:-}" ]]; then
  echo "Set VISITOR_BADGE_SECRETS to the plaintext door code(s) (comma-separated for multiple)." >&2
  exit 1
fi

gcloud services enable secretmanager.googleapis.com run.googleapis.com --project="${PROJECT_ID}"

if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${VISITOR_BADGE_SECRETS}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
else
  echo -n "${VISITOR_BADGE_SECRETS}" | gcloud secrets create "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
fi

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

if [[ "${SKIP_CLOUD_RUN_UPDATE:-}" == "1" ]]; then
  echo "Done. ${SECRET_NAME} is in Secret Manager (SKIP_CLOUD_RUN_UPDATE=1; Cloud Run unchanged)."
  echo "Next deploy will attach VISITOR_BADGE_SECRETS when the secret exists."
  exit 0
fi

for svc in "${SERVICES[@]}"; do
  if ! gcloud run services describe "${svc}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "Skip ${svc} (service not found)."
    continue
  fi
  SECRETS="VISITOR_BADGE_SECRETS=${SECRET_NAME}:latest"
  if gcloud secrets describe "${OPENROUTER_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="OPENROUTER_API_KEY=${OPENROUTER_SECRET}:latest,${SECRETS}"
  fi
  if gcloud secrets describe "${DEEPSEEK_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="DEEPSEEK_API_KEY=${DEEPSEEK_SECRET}:latest,${SECRETS}"
  fi
  if gcloud secrets describe "${INVITE_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="INVITE_TOKEN_SECRET=${INVITE_SECRET}:latest,${SECRETS}"
  fi
  echo "Updating ${svc} …"
  gcloud run services update "${svc}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --set-secrets="${SECRETS}"
done

echo "Done. visitor-badge-secrets is in Secret Manager; Cloud Run mounts VISITOR_BADGE_SECRETS on next revision."
