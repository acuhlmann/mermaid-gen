#!/usr/bin/env bash
# One-off deploy of the hackathon snapshot to a second Cloud Run URL (NOT run from GitHub Actions).
# Run from a clean tree after: git fetch origin --tags && git checkout hackathon-pre-deploy
# Requires: Docker, gcloud auth, same Artifact Registry + IAM as docs/deploy/gcp.md
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP project: gcloud config set project YOUR_PROJECT_ID or export GCP_PROJECT_ID=" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE_NAME:-mermaid-gen-hackathon}"
AR_REPO="${AR_REPO:-mermaid-gen}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/web-hackathon"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Project=${PROJECT_ID} Region=${REGION} Service=${SERVICE}"
echo "Git HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}"
fi
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

TAG="hackathon-$(git rev-parse --short HEAD 2>/dev/null || echo manual)"
docker build --build-arg UI_VARIANT=main-only -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" .
docker push "${IMAGE}:${TAG}"
docker push "${IMAGE}:latest"

DEPLOY_ARGS=(
  run deploy "${SERVICE}"
  --project="${PROJECT_ID}"
  --region="${REGION}"
  --image="${IMAGE}:${TAG}"
  --platform=managed
  --allow-unauthenticated
  --port=8080
)

if gcloud secrets describe openrouter-api-key --project="${PROJECT_ID}" &>/dev/null; then
  DEPLOY_ARGS+=(--set-secrets="OPENROUTER_API_KEY=openrouter-api-key:latest")
else
  echo "Warning: Secret openrouter-api-key not found; deploy without LLM until you create it." >&2
fi

gcloud "${DEPLOY_ARGS[@]}"

echo ""
echo "Hackathon snapshot URL (root path):"
echo "  https://${SERVICE}-*.run.app/"
echo "(Exact hostname from gcloud output above.)"
