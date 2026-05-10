#!/usr/bin/env bash
# Deploy the **main** line app to Cloud Run (single SPA at `/`). Matches GitHub Actions build.
# Hackathon snapshot → scripts/deploy-hackathon-cloud-run.sh (second URL, not CI).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP project: gcloud config set project YOUR_PROJECT_ID or export GCP_PROJECT_ID=" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE_NAME:-mermaid-gen-main}"
AR_REPO="${AR_REPO:-mermaid-gen}"
IMAGE_NAME="${IMAGE_NAME:-web-main}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Project=${PROJECT_ID} Region=${REGION} Service=${SERVICE} Image=${IMAGE}"

gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}"
fi
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

push_image() {
  docker build --build-arg UI_VARIANT=main-only -t "${IMAGE}:latest" .
  docker push "${IMAGE}:latest"
}

if push_image; then
  echo "Built and pushed with local Docker."
else
  echo "" >&2
  echo "Local docker build/push failed; trying Cloud Build (image includes both / and /hackathon bundles)." >&2
  if ! gcloud builds submit --project="${PROJECT_ID}" --tag "${IMAGE}:latest" .; then
    echo "" >&2
    echo "Cloud Build failed. Grant Cloud Build + Artifact Registry permissions, or fix Docker locally." >&2
    exit 1
  fi
fi

DEPLOY_ARGS=(
  run deploy "${SERVICE}"
  --project="${PROJECT_ID}"
  --region="${REGION}"
  --image="${IMAGE}:latest"
  --platform=managed
  --allow-unauthenticated
  --port=8080
)

if gcloud secrets describe openrouter-api-key --project="${PROJECT_ID}" &>/dev/null; then
  DEPLOY_ARGS+=(--set-secrets="OPENROUTER_API_KEY=openrouter-api-key:latest")
else
  echo "Warning: Secret openrouter-api-key not found; deploy without LLM until you create it (docs/deploy/gcp.md)." >&2
fi

gcloud "${DEPLOY_ARGS[@]}"

echo ""
echo "Main line URL (root): service URL from gcloud above."
echo "Hackathon snapshot (second URL): checkout tag hackathon-pre-deploy then run scripts/deploy-hackathon-cloud-run.sh"
