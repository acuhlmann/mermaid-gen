#!/usr/bin/env bash
# Apply (or re-apply) Artifact Registry cleanup policies for mermaid-gen.
# GCP runs these policies continuously — this script only syncs the desired state.
#
# Usage:
#   scripts/apply-artifact-registry-cleanup.sh           # apply policy
#   scripts/apply-artifact-registry-cleanup.sh --verify  # check policy exists
#   scripts/apply-artifact-registry-cleanup.sh --prune   # also one-shot prune web-main
#   scripts/apply-artifact-registry-cleanup.sh --prune --dry-run
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-mermaid-gen}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POLICY="${ROOT}/scripts/artifact-registry-cleanup-policy.json"

VERIFY=0
PRUNE=0
DRY_RUN=0
SOFT=0

for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    --prune) PRUNE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --soft) SOFT=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP project: export GCP_PROJECT_ID=… or gcloud config set project …" >&2
  exit 1
fi

if [[ ! -f "${POLICY}" ]]; then
  echo "Missing policy file: ${POLICY}" >&2
  exit 1
fi

fail_or_soft() {
  local msg="$1"
  if [[ "${SOFT}" -eq 1 ]]; then
    echo "WARN: ${msg} (continuing because --soft)" >&2
    exit 0
  fi
  echo "ERROR: ${msg}" >&2
  exit 1
}

if [[ "${VERIFY}" -eq 1 ]]; then
  yaml="$(gcloud artifacts repositories describe "${AR_REPO}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --format='yaml(cleanupPolicies)' 2>/dev/null || true)"
  if [[ -z "${yaml}" || "${yaml}" == *"null"* || "${yaml}" != *"keep-minimum-10-versions"* ]]; then
    fail_or_soft "cleanup policy not applied on ${AR_REPO} (${REGION})"
  fi
  echo "OK: Artifact Registry cleanup policy present on ${AR_REPO}"
  echo "${yaml}"
  exit 0
fi

if ! gcloud artifacts repositories describe "${AR_REPO}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" &>/dev/null; then
  fail_or_soft "repository ${AR_REPO} not found in ${PROJECT_ID}/${REGION}"
fi

echo "Applying cleanup policy to ${PROJECT_ID}/${REGION}/${AR_REPO}…"
if ! gcloud artifacts repositories set-cleanup-policies "${AR_REPO}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --policy="${POLICY}" \
  --no-dry-run; then
  fail_or_soft "failed to set cleanup policies (need artifactregistry.repositories.update)"
fi

echo "Applied. Active policies:"
gcloud artifacts repositories describe "${AR_REPO}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --format='yaml(cleanupPolicies,cleanupPolicyDryRun)'

if [[ "${PRUNE}" -eq 1 ]]; then
  PRUNE_ARGS=(
    --project="${PROJECT_ID}"
    --region="${REGION}"
    --ar-repo="${AR_REPO}"
    --keep-count=10
  )
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    PRUNE_ARGS+=(--dry-run)
  fi
  echo "Running one-shot prune…"
  python3 "${ROOT}/scripts/cleanup-artifact-registry.py" "${PRUNE_ARGS[@]}"
fi
