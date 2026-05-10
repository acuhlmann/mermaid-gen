# Deploy on Google Cloud (Cloud Run)

This app is an Express API plus a Vite-built SPA served from the same process ([`apps/server/src/index.js`](../../apps/server/src/index.js)). Production traffic runs well on **Cloud Run** with container images stored in **Artifact Registry**. Usage is billed to your linked billing account (including [promotional credits](https://console.cloud.google.com/billing)).

Replace placeholders such as `PROJECT_ID`, `REGION`, and `AR_REPO` with your values.

## Billing credits (any linked project)

Credits live on your **billing account** (open [Google Cloud Billing](https://console.cloud.google.com/billing), select the account, then open **Credits**). **Any GCP project linked to that billing account** will invoice usage (Cloud Run, Artifact Registry, outbound egress, etc.) to that account, and **eligible credits are applied there**—the project ID itself does not “hold” credits.

Practical steps:

1. Create or pick a project where your Google identity has **Owner** (or enough rights to enable APIs and deploy Cloud Run).
2. **Link that project** to the billing account that shows your credits (**Billing → Manage billing account → My projects**).
3. Deploy into that project; usage appears under that billing account.

Verify linkage:

```bash
gcloud billing projects describe PROJECT_ID
```

## CI/CD from GitHub (`main` / `master`)

Workflow: [`.github/workflows/deploy-cloud-run.yml`](../../.github/workflows/deploy-cloud-run.yml). It runs on pushes to **`main`** or **`master`** and deploys **`mermaid-gen-main`** only (`UI_VARIANT=main-only`, image `…/web-main`).

The **hackathon** snapshot uses a **second Cloud Run service** and is **not** updated by GitHub Actions. After checking out the snapshot Git ref you want, run [`scripts/deploy-hackathon-cloud-run.sh`](../../scripts/deploy-hackathon-cloud-run.sh) (image `…/web-hackathon`). Two public URLs, one pipeline.

### Example project [MermaidGen](https://console.cloud.google.com/home/dashboard?project=mermaidgen&organizationId=0)

Set **`GCP_PROJECT_ID`** (`mermaidgen`) plus Workload Identity secrets as below. Services (adjust region if you changed it):

- **Main (CI):** `mermaid-gen-main` → `https://mermaid-gen-main-<PROJECT_NUMBER>.us-central1.run.app/`
- **Hackathon (manual):** `mermaid-gen-hackathon` → `https://mermaid-gen-hackathon-<PROJECT_NUMBER>.us-central1.run.app/`

### One-time GCP setup for GitHub Actions

1. Enable APIs on `PROJECT_ID`:

   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com secretmanager.googleapis.com --project=PROJECT_ID
   ```

2. Create Artifact Registry repo `mermaid-gen` in `REGION` if missing (same as [`scripts/deploy-cloud-run.sh`](../../scripts/deploy-cloud-run.sh)).

3. Create a **deployer service account** (example name `github-deploy-mermaid-gen`) and grant it:

   - `roles/run.admin`
   - `roles/artifactregistry.writer`
   - `roles/iam.serviceAccountUser` on the **Cloud Run runtime** service account (often `PROJECT_NUMBER-compute@developer.gserviceaccount.com`) so deploy can attach revisions.

4. Configure **Workload Identity Federation** so GitHub can impersonate that SA (recommended; no JSON keys). Follow Google’s guide: [Authenticate to Google Cloud from GitHub Actions](https://github.com/google-github-actions/auth#setting-up-workload-identity-federation) (pool + OIDC provider + binding).

   Creating the GitHub OIDC provider requires an **`--attribute-condition`** that references JWT claims (GCP rejects providers without it). Restrict to your repo, for example:

   ```bash
   POOL=github-actions-pool
   PROVIDER=github
   PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
   gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}" \
     --project=PROJECT_ID --location=global --workload-identity-pool="${POOL}" \
     --display-name="GitHub Actions OIDC" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
     --attribute-condition="assertion.repository == 'OWNER/REPO'"
   ```

   Grant **`roles/iam.workloadIdentityUser`** on the deployer SA for  
   `principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/attribute.repository/OWNER/REPO`  
   (same `OWNER/REPO` string as in the condition).

5. In the GitHub repo **Settings → Secrets and variables → Actions**, add:

   | Secret | Example |
   |--------|---------|
   | `GCP_PROJECT_ID` | e.g. `mermaidgen` |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name from `gcloud iam workload-identity-pools providers describe …` |
   | `GCP_SERVICE_ACCOUNT` | Deployer SA email, e.g. `github-deploy-mermaid-gen@PROJECT_ID.iam.gserviceaccount.com` |

6. Optional: create Secret Manager secret **`openrouter-api-key`** for LLM features; grant the **runtime** SA `secretAccessor` on it (see below).

## Two Cloud Run URLs (recommended): main vs hackathon snapshot

**Main line:** [`scripts/deploy-cloud-run.sh`](../../scripts/deploy-cloud-run.sh) → service **`mermaid-gen-main`**, image **`web-main`**, SPA at **`/`**.

**Hackathon snapshot:** [`scripts/deploy-hackathon-cloud-run.sh`](../../scripts/deploy-hackathon-cloud-run.sh) (run locally after `git checkout` of the tag or branch you want to freeze) → service **`mermaid-gen-hackathon`**, image **`web-hackathon`**, SPA at **`/`** on its **own hostname**.

Both omit `VITE_API_BASE_URL` at build time so each service calls its **own** `/api/...`. Shared backend behavior unless you rebuild the hackathon image from an older commit.

```bash
chmod +x scripts/deploy-cloud-run.sh scripts/deploy-hackathon-cloud-run.sh
export GCP_PROJECT_ID=mermaidgen   # example
./scripts/deploy-cloud-run.sh
./scripts/deploy-hackathon-cloud-run.sh   # optional second URL; uses current tree / checkout
```

Optional env overrides: `REGION` (default `us-central1`), `AR_REPO` (default `mermaid-gen`). Create Secret Manager secret **`openrouter-api-key`** if you want LLM features (see below).

### Legacy: one hostname with `/` and `/hackathon/` paths

Build with **`UI_VARIANT=full`** (Docker default). [`apps/server/src/index.js`](../../apps/server/src/index.js) serves **`/hackathon/`** as a second bundle on the **same** service. Use this only if you prefer one `*.run.app` URL and path routing instead of two services.

## Prerequisites

1. **Google Cloud SDK**: [`gcloud`](https://cloud.google.com/sdk/docs/install) installed and authenticated:

   ```bash
   gcloud auth login
   gcloud config set project PROJECT_ID
   ```

2. **Billing**: Confirm the project is attached to the billing account that holds your credits:

   ```bash
   gcloud billing projects describe PROJECT_ID
   ```

3. **GitHub CLI** (optional, for verifying tags/commits):

   ```bash
   gh release view hackathon-pre-deploy -R acuhlmann/mermaid-gen
   ```

4. **Enable APIs** (once per project):

   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=PROJECT_ID
   ```

## Secrets (required for LLM features)

`.env` is **only for local development**. Cloud Run never reads your laptop’s `.env`; put the key in **Secret Manager** and expose it as env var **`OPENROUTER_API_KEY`** on the service (already wired in [`scripts/deploy-cloud-run.sh`](../../scripts/deploy-cloud-run.sh), [`scripts/deploy-hackathon-cloud-run.sh`](../../scripts/deploy-hackathon-cloud-run.sh), and the GitHub Actions workflow).

### One command (recommended)

From the repo root, with the same key you use locally:

```bash
chmod +x scripts/push-openrouter-secret-cloud-run.sh
export OPENROUTER_API_KEY='your-key-here'   # paste from local .env (never commit)
GCP_PROJECT_ID=mermaidgen REGION=us-central1 bash scripts/push-openrouter-secret-cloud-run.sh
```

That creates or updates secret **`openrouter-api-key`**, grants the default Cloud Run runtime service account **`secretAccessor`**, and runs **`gcloud run services update`** on **`mermaid-gen-main`** and **`mermaid-gen-hackathon`** so both pick up the secret.

Optional: set **`OPENROUTER_SITE_URL`** to your public app URL (e.g. `https://mermaid-gen-main-….run.app`) for OpenRouter metadata—either add `--set-env-vars` on update or redeploy with env vars.

### Manual steps

```bash
echo -n "$OPENROUTER_API_KEY" | gcloud secrets create openrouter-api-key --data-file=- --project=PROJECT_ID
# Or add a new version if the secret already exists:
echo -n "$OPENROUTER_API_KEY" | gcloud secrets versions add openrouter-api-key --data-file=- --project=PROJECT_ID
```

Grant the Cloud Run **runtime service account** permission to access the secret (adjust member if you use a custom runtime SA):

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding openrouter-api-key \
  --project=PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Attach the secret to **each** service that needs LLMs (new revisions only):

```bash
for svc in mermaid-gen-main mermaid-gen-hackathon; do
  gcloud run services update "$svc" --region=REGION --project=PROJECT_ID \
    --set-secrets="OPENROUTER_API_KEY=openrouter-api-key:latest"
done
```

## Artifact Registry

Create a Docker repository (once):

```bash
gcloud artifacts repositories create AR_REPO \
  --repository-format=docker \
  --location=REGION \
  --project=PROJECT_ID

gcloud auth configure-docker REGION-docker.pkg.dev
```

## Build matrix (two app variants)

| Variant    | Git source                         | Docker image tag (example) | Purpose                                      |
|-----------|-------------------------------------|----------------------------|----------------------------------------------|
| **main**  | `master` (or your default branch) | `main`                     | Primary URL; redeploy when you ship changes. |
| **hackathon** | Tag `hackathon-pre-deploy`      | `hackathon`                | Frozen snapshot from the hackathon release.  |

Check out the commit you want, then build with **`--build-arg`** so the browser bundle points at the correct public API origin.

### A) Two Cloud Run URLs (recommended MVP)

Deploy **two separate services** at different `*.run.app` hostnames. No load balancer; fastest path to a public demo.

**Main** (same-origin API + SPA — replace `MAIN_SERVICE_URL` with the URL Cloud Run prints after first deploy, or your predicted URL):

```bash
git checkout master
docker build \
  --build-arg VITE_API_BASE_URL=https://main-service-xxxxx.run.app \
  --build-arg VITE_BASE_PATH=/ \
  -t REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/mermaid-gen:main .

docker push REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/mermaid-gen:main

gcloud run deploy mermaid-gen-main \
  --project=PROJECT_ID \
  --region=REGION \
  --image=REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/mermaid-gen:main \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-secrets=OPENROUTER_API_KEY=openrouter-api-key:latest \
  --set-env-vars=OPENROUTER_SITE_URL=https://main-service-xxxxx.run.app
```

After the first deploy, copy the real HTTPS URL and **rebuild** the image with the matching `VITE_API_BASE_URL`, then redeploy (the SPA embeds this string at build time).

**Hackathon** (checkout tag, build, deploy):

```bash
git fetch origin --tags
git checkout hackathon-pre-deploy

docker build \
  --build-arg VITE_API_BASE_URL=https://hackathon-service-yyyyy.run.app \
  --build-arg VITE_BASE_PATH=/ \
  -t REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/mermaid-gen:hackathon .

docker push REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/mermaid-gen:hackathon

gcloud run deploy mermaid-gen-hackathon \
  --project=PROJECT_ID \
  --region=REGION \
  --image=REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/mermaid-gen:hackathon \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-secrets=OPENROUTER_API_KEY=openrouter-api-key:latest \
  --set-env-vars=OPENROUTER_SITE_URL=https://hackathon-service-yyyyy.run.app
```

Optional environment variables (Mermaid MCP, model overrides, etc.) can be appended with additional `--set-env-vars` flags or a comma-separated list; mirror variables from [`.env.example`](../../.env.example).

### B) One custom domain with `/hackathon` path (optional)

To present **one hostname** where `/` is **main** and `/hackathon/` is the frozen build:

1. Deploy **two** Cloud Run services (same as above), built with:
   - **main**: `VITE_BASE_PATH=/`, `VITE_API_BASE_URL=https://your-domain.example.com`
   - **hackathon**: `VITE_BASE_PATH=/hackathon/`, `VITE_API_BASE_URL=https://your-domain.example.com/hackathon`
2. Create an **External HTTPS Load Balancer** with a **URL map**:
   - Route **`/hackathon/*`** to the hackathon service (serverless NEG).
   - Default route **`/*`** to the main service.
3. Add a **path rewrite** on the hackathon backend so the prefix `/hackathon` is stripped before the request reaches Cloud Run. The container then continues to serve `/`, `/api/*` as implemented today.
4. Attach a **managed SSL certificate** and point **DNS** at the load balancer IP.

This adds monthly load balancer cost and more moving parts; use it when you need a single branded URL.

## Smoke test

```bash
curl -sS "https://YOUR_SERVICE_URL/api/health"
```

Open the service URL in a browser and confirm the UI loads and Copilot traffic reaches `/api/copilotkit/*`.

## Investigation commands

```bash
gcloud run services list --region=REGION --project=PROJECT_ID
gcloud run services describe SERVICE_NAME --region=REGION --project=PROJECT_ID
gcloud logging read 'resource.type="cloud_run_revision"' --limit=30 --freshness=15m --project=PROJECT_ID
```

## Troubleshooting

**`gcloud builds submit` PERMISSION_DENIED:** Your Google account needs permission to run Cloud Build and push to Artifact Registry (often **Cloud Build Editor**, **Run Admin**, **Artifact Registry Writer**, and Storage access for the Cloud Build source bucket). Ask a project owner to grant those roles, or build and push locally with Docker then deploy only the image:

```bash
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/mermaid-gen/web:latest .
docker push us-central1-docker.pkg.dev/PROJECT_ID/mermaid-gen/web:latest
gcloud run deploy mermaid-gen --region=us-central1 --image=us-central1-docker.pkg.dev/PROJECT_ID/mermaid-gen/web:latest --allow-unauthenticated --port=8080
```
