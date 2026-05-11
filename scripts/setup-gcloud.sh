#!/usr/bin/env bash
# Install Google Cloud CLI for agent/dev environments (Linux x86_64 / arm64).
# Idempotent: skips download if gcloud is already on PATH and working.
#
# Optional auth (after install):
#   - GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
#   - GCP_MERMAID_GEN=/path/to/key.json  (Cursor-style secret path)
#
# Override install root:
#   GCLOUD_INSTALL_DIR=$HOME/my-gcloud bash scripts/setup-gcloud.sh

set -euo pipefail

ROOT="${GCLOUD_INSTALL_DIR:-$HOME/google-cloud-sdk}"
# Non-login shells often lack gcloud on PATH even after a prior install; prefer existing SDK dir.
export PATH="${ROOT}/bin:${PATH}"

if command -v gcloud >/dev/null 2>&1 && gcloud version >/dev/null 2>&1; then
  echo "gcloud already available: $(command -v gcloud)"
else
  case "$(uname -m)" in
    x86_64) GCLOUD_DL_ARCH=x86_64 ;;
    aarch64 | arm64) GCLOUD_DL_ARCH=arm ;;
    *)
      echo "Unsupported machine: $(uname -m)" >&2
      exit 1
      ;;
  esac

  TMP="${TMPDIR:-/tmp}/gcloud-cli-$$"
  mkdir -p "$TMP"
  trap 'rm -rf "$TMP"' EXIT

  URL="https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-${GCLOUD_DL_ARCH}.tar.gz"
  echo "Downloading Cloud SDK (${GCLOUD_DL_ARCH})…"
  curl -fsSL "$URL" -o "$TMP/google-cloud-cli.tar.gz"
  rm -rf "$ROOT"
  mkdir -p "$(dirname "$ROOT")"
  tar -xzf "$TMP/google-cloud-cli.tar.gz" -C "$TMP"
  mv "$TMP/google-cloud-sdk" "$ROOT"

  CLOUDSDK_CORE_DISABLE_PROMPTS=1
  export CLOUDSDK_CORE_DISABLE_PROMPTS
  "$ROOT/install.sh" \
    --quiet \
    --usage-reporting false \
    --command-completion false \
    --path-update true

  echo "Installed Cloud SDK to $ROOT"
fi

# Ensure this shell and child processes (e.g. npm scripts) see gcloud.
export PATH="${ROOT}/bin:${PATH}"

KEY_FILE=""
if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
  KEY_FILE="${GOOGLE_APPLICATION_CREDENTIALS}"
elif [[ -n "${GCP_MERMAID_GEN:-}" && -f "${GCP_MERMAID_GEN}" ]]; then
  KEY_FILE="${GCP_MERMAID_GEN}"
fi

if [[ -n "$KEY_FILE" ]]; then
  echo "Activating service account from key file…"
  gcloud auth activate-service-account --key-file="$KEY_FILE" --quiet
fi

# Sensible defaults for this repo (no-op if unset project is forbidden).
if gcloud projects describe mermaidgen >/dev/null 2>&1; then
  gcloud config set project mermaidgen --quiet
  gcloud config set compute/region us-central1 --quiet
  echo "gcloud project: mermaidgen, region: us-central1"
elif gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  echo "gcloud installed; set project with: gcloud config set project YOUR_PROJECT_ID"
else
  echo "gcloud installed; authenticate with: gcloud auth login  or a service account key file."
fi

gcloud version
