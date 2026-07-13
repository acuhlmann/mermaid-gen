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
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
SERVICE="${SERVICE_NAME:-mermaid-gen-hackathon}"
AR_REPO="${AR_REPO:-mermaid-gen}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/web-hackathon"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Project=${PROJECT_ID} Region=${REGION} Service=${SERVICE}"
echo "Git HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

export GCP_PROJECT_ID="${PROJECT_ID}"
"${ROOT}/scripts/verify-gcp-billing.sh"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com \
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
  --min-instances="${MIN_INSTANCES}"
  --max-instances="${MAX_INSTANCES}"
)

CLOUD_RUN_SECRETS=()
if gcloud secrets describe openrouter-api-key --project="${PROJECT_ID}" &>/dev/null; then
  CLOUD_RUN_SECRETS+=("OPENROUTER_API_KEY=openrouter-api-key:latest")
else
  echo "Warning: Secret openrouter-api-key not found; deploy without LLM until you create it." >&2
fi
if gcloud secrets describe invite-token-secret --project="${PROJECT_ID}" &>/dev/null; then
  CLOUD_RUN_SECRETS+=("INVITE_TOKEN_SECRET=invite-token-secret:latest")
else
  echo "Warning: Secret invite-token-secret not found; run npm run secret:invite-token:cloud-run." >&2
fi
if ((${#CLOUD_RUN_SECRETS[@]} > 0)); then
  DEPLOY_ARGS+=(--set-secrets="$(IFS=,; echo "${CLOUD_RUN_SECRETS[*]}")")
fi

VERTEX_LOCATION="${VERTEX_LOCATION:-us-central1}"
VERTEX_MODEL_FAST="${VERTEX_MODEL_FAST:-gemini-2.5-flash}"
VERTEX_MODEL_QUALITY="${VERTEX_MODEL_QUALITY:-gemini-2.5-pro}"
VERTEX_PROJECT_ID="${VERTEX_PROJECT_ID:-${PROJECT_ID}}"
VERTEX_ENV_VARS="VERTEX_LOCATION=${VERTEX_LOCATION},VERTEX_MODEL_FAST=${VERTEX_MODEL_FAST},VERTEX_MODEL_QUALITY=${VERTEX_MODEL_QUALITY},VERTEX_PROJECT_ID=${VERTEX_PROJECT_ID},GOOGLE_CLOUD_PROJECT=${VERTEX_PROJECT_ID}"
if [[ -n "${LLM_PROVIDER:-}" ]]; then
  VERTEX_ENV_VARS="${VERTEX_ENV_VARS},LLM_PROVIDER=${LLM_PROVIDER}"
fi
if [[ -n "${OPENROUTER_PREFERRED:-}" ]]; then
  VERTEX_ENV_VARS="${VERTEX_ENV_VARS},OPENROUTER_PREFERRED=${OPENROUTER_PREFERRED}"
fi
DEPLOY_ARGS+=(--set-env-vars="${VERTEX_ENV_VARS}")

gcloud "${DEPLOY_ARGS[@]}"

echo ""
echo "Hackathon snapshot URL (root path):"
echo "  https://${SERVICE}-*.run.app/"
echo "(Exact hostname from gcloud output above.)"
