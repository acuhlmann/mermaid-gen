#!/usr/bin/env bash
# Fail fast when GCP project billing is disabled (Artifact Registry push / Cloud Run deploy).
# Used by deploy-cloud-run.sh and .github/workflows/deploy-cloud-run.yml.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP project: export GCP_PROJECT_ID=… or gcloud config set project …" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-mermaid-gen}"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)' 2>/dev/null || true)"
ENABLE_URL="https://console.developers.google.com/billing/enable?project=${PROJECT_NUMBER:-${PROJECT_ID}}"

print_billing_fix() {
  echo "" >&2
  echo "ERROR: GCP billing is not enabled for project ${PROJECT_ID}." >&2
  echo "" >&2
  echo "Deploy Cloud Run fails at docker push with:" >&2
  echo "  denied: This API method requires billing to be enabled." >&2
  echo "" >&2
  echo "This is an infrastructure issue, not an application build failure." >&2
  echo "CI passes; only Artifact Registry / Cloud Run billable APIs are blocked." >&2
  echo "" >&2
  echo "Fix (project Owner or Billing Administrator):" >&2
  echo "  1. Open: ${ENABLE_URL}" >&2
  echo "  2. Link the billing account that holds your credits." >&2
  echo "  3. Verify: gcloud billing projects describe ${PROJECT_ID}" >&2
  echo "  4. Re-run deploy: Actions → Deploy Cloud Run → Run workflow" >&2
  echo "" >&2
}

billing_enabled=""
if billing_enabled="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null)"; then
  if [[ "${billing_enabled}" == "True" ]]; then
    echo "Billing enabled for project ${PROJECT_ID}."
    exit 0
  fi
  print_billing_fix
  echo "gcloud billing projects describe returned billingEnabled=${billing_enabled}" >&2
  echo "" >&2
  exit 1
fi

# Deploy SAs often lack billing.viewer; probe a billable API the deployer can use instead.
if gcloud artifacts repositories describe "${AR_REPO}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "Billing preflight: billing API unreadable for ${PROJECT_ID}; Artifact Registry OK — continuing."
  exit 0
fi

print_billing_fix
echo "gcloud billing projects describe failed (billing API disabled or no permission)." >&2
echo "Artifact Registry probe also failed for ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}." >&2
echo "If billing was linked recently, wait a few minutes and retry." >&2
echo "" >&2
exit 1
