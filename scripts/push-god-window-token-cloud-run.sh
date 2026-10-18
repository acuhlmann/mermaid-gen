#!/usr/bin/env bash
# Create or rotate Secret Manager secret god-window-token and attach it to the Cloud Run service.
# Requires GOD_WINDOW_TOKEN (plaintext owner token). Never commit the value.
#
# Example:
#   GOD_WINDOW_TOKEN="$(openssl rand -hex 32)" \
#     GCP_PROJECT_ID=mermaidgen REGION=us-central1 \
#     bash scripts/push-god-window-token-cloud-run.sh
# Secret Manager only (no Cloud Run revision):
#   SKIP_CLOUD_RUN_UPDATE=1 GOD_WINDOW_TOKEN='…' bash scripts/push-god-window-token-cloud-run.sh
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or gcloud config set project …" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SECRET_NAME="${GOD_WINDOW_SECRET_NAME:-god-window-token}"
SERVICES=(mermaid-gen-main)
OPENROUTER_SECRET="${OPENROUTER_SECRET_NAME:-openrouter-api-key}"
DEEPSEEK_SECRET="${DEEPSEEK_SECRET_NAME:-deepseek-api-key}"
INVITE_SECRET="${INVITE_TOKEN_SECRET_NAME:-invite-token-secret}"
BADGE_SECRET="${VISITOR_BADGE_SECRET_NAME:-visitor-badge-secrets}"

if [[ -z "${GOD_WINDOW_TOKEN:-}" ]]; then
  echo "Set GOD_WINDOW_TOKEN to the plaintext owner token (openssl rand -hex 32 recommended)." >&2
  exit 1
fi

gcloud services enable secretmanager.googleapis.com run.googleapis.com --project="${PROJECT_ID}"

# Piped, never an argument: a token in argv is readable by any process on the box and lands in shell history.
if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${GOD_WINDOW_TOKEN}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
else
  echo -n "${GOD_WINDOW_TOKEN}" | gcloud secrets create "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
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
  echo "The next deploy mounts GOD_WINDOW_TOKEN when the secret exists (scripts/deploy-cloud-run.sh)."
  exit 0
fi

for svc in "${SERVICES[@]}"; do
  if ! gcloud run services describe "${svc}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "Skip ${svc} (service not found)."
    continue
  fi
  # --set-secrets replaces the whole list, so every secret the service already mounts must be re-stated
  # here or this command silently removes it. Mirrors the list in scripts/deploy-cloud-run.sh.
  SECRETS="GOD_WINDOW_TOKEN=${SECRET_NAME}:latest"
  if gcloud secrets describe "${OPENROUTER_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="${SECRETS},OPENROUTER_API_KEY=${OPENROUTER_SECRET}:latest"
  fi
  if gcloud secrets describe "${DEEPSEEK_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="${SECRETS},DEEPSEEK_API_KEY=${DEEPSEEK_SECRET}:latest"
  fi
  if gcloud secrets describe "${INVITE_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="${SECRETS},INVITE_TOKEN_SECRET=${INVITE_SECRET}:latest"
  fi
  if gcloud secrets describe "${BADGE_SECRET}" --project="${PROJECT_ID}" &>/dev/null; then
    SECRETS="${SECRETS},VISITOR_BADGE_SECRETS=${BADGE_SECRET}:latest"
  fi
  echo "Updating ${svc} …"
  gcloud run services update "${svc}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --set-secrets="${SECRETS}"
done

echo "Done. ${SECRET_NAME} is in Secret Manager; Cloud Run mounts GOD_WINDOW_TOKEN."
