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

### Example project [ArchiSlop](https://console.cloud.google.com/home/dashboard?project=mermaidgen&organizationId=0)

Set **`GCP_PROJECT_ID`** (`mermaidgen`) plus Workload Identity secrets as below. Services (adjust region if you changed it):

- **Main (CI):** `mermaid-gen-main` → `https://mermaid-gen-main-<PROJECT_NUMBER>.us-central1.run.app/`
- **Hackathon (manual):** `mermaid-gen-hackathon` → `https://mermaid-gen-hackathon-<PROJECT_NUMBER>.us-central1.run.app/`

### One-time GCP setup for GitHub Actions

1. Enable APIs on `PROJECT_ID`:

   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com --project=PROJECT_ID
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

   | Secret                           | Example                                                                                    |
   | -------------------------------- | ------------------------------------------------------------------------------------------ |
   | `GCP_PROJECT_ID`                 | e.g. `mermaidgen`                                                                          |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name from `gcloud iam workload-identity-pools providers describe …` |
   | `GCP_SERVICE_ACCOUNT`            | Deployer SA email, e.g. `github-deploy-mermaid-gen@PROJECT_ID.iam.gserviceaccount.com`     |

6. Optional: create Secret Manager secrets **`deepseek-api-key`** (Brain Quality / hybrid) and/or **`openrouter-api-key`** (backup / OpenRouter-preferred); grant the **runtime** SA `secretAccessor` on them (see below).

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

Optional env overrides: `REGION` (default `us-central1`), `AR_REPO` (default `mermaid-gen`). Create Secret Manager secret **`deepseek-api-key`** for Brain Quality (hybrid with Vertex) and optionally **`openrouter-api-key`** (see below).

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
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com --project=PROJECT_ID
   ```

## Vertex AI (optional: Gemini on Cloud Run)

When the API server runs on **Cloud Run**, it can call **Vertex AI** (Gemini / Gemma) using the **runtime service account**—no Google API key in the container. Deploy scripts set `VERTEX_*` env vars by default; override them if you use other model IDs or regions.

1. **Enable the Vertex AI API** (included in the combined `gcloud services enable` commands above, or run alone):

   ```bash
   gcloud services enable aiplatform.googleapis.com --project=PROJECT_ID
   ```

2. **Grant the Cloud Run runtime service account** permission to use Vertex AI (default compute SA unless you use a custom runtime SA):

   ```bash
   PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

3. **Configure routing** (see [`.env.example`](../../.env.example)):
   - **`LLM_PROVIDER=auto`** (default): on Cloud Run (`K_SERVICE` is set), prefer Vertex when **`VERTEX_PROJECT_ID`** (set automatically by deploy scripts from `GCP_PROJECT_ID`) and region resolve. When **`DEEPSEEK_API_KEY`** is also attached, Brain **Fast** stays on Vertex Gemini Flash and Brain **Quality** uses DeepSeek V4 Pro (`deepseek-v4-pro`). Set **`OPENROUTER_PREFERRED=1`** to use OpenRouter first whenever the key is present (including on Cloud Run).
   - **`LLM_PROVIDER=vertex`**: Vertex only (requires a resolvable GCP project and region).
   - **`LLM_PROVIDER=deepseek`**: DeepSeek only (requires Secret Manager or env key).
   - **`LLM_PROVIDER=openrouter`**: OpenRouter only (requires Secret Manager or env key).

Keep the **`deepseek-api-key`** secret attached for hybrid Brain Quality. Keep **`openrouter-api-key`** if you want **OpenRouter as backup** (analyze streaming retries once on OpenRouter after a Vertex stream error) or when using **`OPENROUTER_PREFERRED=1`**. Local development typically uses DeepSeek and/or OpenRouter from `.env`; Vertex locally needs `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, and Application Default Credentials (for example `gcloud auth application-default login`).

## Office WaveNet TTS (optional: spoken walk-bys / meetings / battles)

Office narration prefers **Google Cloud Text-to-Speech (WaveNet)** when a GCP project id resolves; otherwise the browser falls back to Web Speech. See [`docs/office-narration-roadmap.md`](../office-narration-roadmap.md).

1. **Enable the API:**

   ```bash
   gcloud services enable texttospeech.googleapis.com --project=PROJECT_ID
   ```

2. **Grant the Cloud Run runtime service account** permission to synthesize:

   ```bash
   PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/cloudtts.user"
   ```

3. Deploy scripts already set `VERTEX_PROJECT_ID` on Cloud Run — that is enough for `officeTtsConfigured: true` on `GET /api/health`. Kill switch: `OFFICE_TTS=0`.

## Secrets (DeepSeek for Brain Quality; OpenRouter optional)

`.env` is **only for local development**. Cloud Run never reads your laptop’s `.env`; put keys in **Secret Manager** and expose them as env vars on the service (already wired in [`scripts/deploy-cloud-run.sh`](../../scripts/deploy-cloud-run.sh), [`scripts/deploy-hackathon-cloud-run.sh`](../../scripts/deploy-hackathon-cloud-run.sh), and the GitHub Actions workflow).

### DeepSeek (recommended for hybrid Brain Quality)

```bash
chmod +x scripts/push-deepseek-secret-cloud-run.sh
export DEEPSEEK_API_KEY='your-key-here'   # paste from local .env (never commit)
GCP_PROJECT_ID=mermaidgen REGION=us-central1 bash scripts/push-deepseek-secret-cloud-run.sh
# or: npm run secret:deepseek:cloud-run
```

That creates or updates secret **`deepseek-api-key`**, grants the default Cloud Run runtime service account **`secretAccessor`**, and attaches **`DEEPSEEK_API_KEY`** to **`mermaid-gen-main`** and **`mermaid-gen-hackathon`**.

### OpenRouter (optional backup / preferred)

From the repo root, with the same key you use locally:

```bash
chmod +x scripts/push-openrouter-secret-cloud-run.sh
export OPENROUTER_API_KEY='your-key-here'   # paste from local .env (never commit)
GCP_PROJECT_ID=mermaidgen REGION=us-central1 bash scripts/push-openrouter-secret-cloud-run.sh
```

That creates or updates secret **`openrouter-api-key`**, grants the default Cloud Run runtime service account **`secretAccessor`**, and runs **`gcloud run services update`** on **`mermaid-gen-main`** and **`mermaid-gen-hackathon`** so both pick up the secret.

Optional: set **`OPENROUTER_SITE_URL`** to your public app URL (e.g. `https://mermaid-gen-main-….run.app`) for OpenRouter metadata—either add `--set-env-vars` on update or redeploy with env vars.

### Invite token secret (production MCP)

Signed invite links (`?token=` on `/mcp`) require **`INVITE_TOKEN_SECRET`**. The dev server uses a placeholder; production must use a strong random value in Secret Manager.

```bash
chmod +x scripts/push-invite-token-secret-cloud-run.sh
GCP_PROJECT_ID=mermaidgen REGION=us-central1 bash scripts/push-invite-token-secret-cloud-run.sh
```

This creates or rotates secret **`invite-token-secret`**, grants the runtime service account access, and attaches **`INVITE_TOKEN_SECRET`** to **`mermaid-gen-main`** and **`mermaid-gen-hackathon`**. Deploy scripts also reference this secret when present ([`scripts/deploy-cloud-run.sh`](../../scripts/deploy-cloud-run.sh)).

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

| Variant       | Git source                        | Docker image tag (example) | Purpose                                      |
| ------------- | --------------------------------- | -------------------------- | -------------------------------------------- |
| **main**      | `master` (or your default branch) | `main`                     | Primary URL; redeploy when you ship changes. |
| **hackathon** | Tag `hackathon-pre-deploy`        | `hackathon`                | Frozen snapshot from the hackathon release.  |

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
  --min-instances=0 \
  --max-instances=1 \
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
  --min-instances=0 \
  --max-instances=1 \
  --set-secrets=OPENROUTER_API_KEY=openrouter-api-key:latest \
  --set-env-vars=OPENROUTER_SITE_URL=https://hackathon-service-yyyyy.run.app
```

Optional environment variables (model overrides, `MERMAID_*` tuning, etc.) can be appended with additional `--set-env-vars` flags or a comma-separated list; mirror variables from [`.env.example`](../../.env.example).

### MCP and external agents on Cloud Run

ArchiSlop serves **Streamable HTTP MCP** at `/mcp` on the same Cloud Run service as the API. **Invite agent** in the web UI builds pairing codes and install deeplinks from **`PUBLIC_BASE_URL`** — set it to the public service origin **without a trailing slash**, for example:

```bash
--set-env-vars=PUBLIC_BASE_URL=https://mermaid-gen-main-PROJECT_NUMBER.us-central1.run.app
```

If unset, invite links may fall back to `localhost` and external agents cannot join production rooms. Guest-agent flows (handshakes, proposals, MCP Apps) are documented in [`docs/architecture-external-agents.md`](../architecture-external-agents.md).

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

Open the service URL in a browser and confirm the UI loads, Copilot traffic reaches `/api/copilotkit/*`, and (if using external agents) **Invite agent** shows an `https://…/mcp` URL matching `PUBLIC_BASE_URL`.

### External agents on Cloud Run (MCP + pairing)

- **Single instance (recommended for small teams):** Deploy scripts and CI set **`--max-instances=1`** so all in-memory session state (diagrams, proposals, MCP transport, `session-events`) stays on one container. ArchiSlop does not share diagram state across instances yet — multiple instances without Redis can split rooms.
- **Scale to zero:** **`--min-instances=0`** (default) saves idle cost. After idle, the web UI shows a branded cold-start gate while `/api/health` succeeds (see [HTTP 429 `Rate exceeded.`](#http-429-rate-exceeded-plain-text) if the edge rejects the first request).
- **MCP transport** (`/mcp`) keeps Streamable HTTP session state **in-process**. With `max-instances=1`, MCP clients stay on the same container; occasional `400` after deploy still means re-initialize.
- **Pairing codes** can be shared across instances when **`REDIS_URL`** is set (see `.env.example`). Diagram/session collaboration state remains in-memory per instance unless you add further shared storage.
- Set **`PUBLIC_BASE_URL`**, **`INVITE_TOKEN_SECRET`** (production), and optionally **`ARCHISLOP_WEB_URL`** for correct invite/deeplink and canvas URLs.

## Investigation commands

```bash
gcloud run services list --region=REGION --project=PROJECT_ID
gcloud run services describe SERVICE_NAME --region=REGION --project=PROJECT_ID
gcloud logging read 'resource.type="cloud_run_revision"' --limit=30 --freshness=15m --project=PROJECT_ID
```

## Troubleshooting

### HTTP 429 `Rate exceeded.` (plain text)

If a browser or `curl` shows **`Rate exceeded.`** with **HTTP 429** and response header **`server: Google Frontend`**, the request was **rejected by Cloud Run’s edge** before your Express app ran. This is **not** the application IP rate limiter (that returns JSON: `{"error":"Too many requests. Try again later."}` from [`apps/server/src/middleware/apiRateLimit.ts`](../../apps/server/src/middleware/apiRateLimit.ts)).

Cloud Run request logs usually include:

```text
The request was aborted because there was no available instance.
```

**Common causes:**

| Cause                                 | What happens                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scale to zero** (`min-instances=0`) | Service is idle; the first request(s) arrive while a container is still starting. Bursts (share link + crawler + retry) can all get 429 during the cold-start window. |
| **Max instances reached**             | All containers are busy (long **`session-events`** SSE connections hold slots for ~5 minutes). New requests are rejected until capacity frees or scales up.           |
| **Post-deploy cold start**            | A new revision needs a fresh instance; traffic during rollout can briefly see 429s.                                                                                   |

**`/sessions/{uuid}` is not special** — it is a client-side SPA route; the server only serves `index.html`. A 429 on that path also appears on `/api/health` when no instance is ready.

**Recommended production shape (small teams, in-memory state):**

| Setting         | Value | Why                                                                |
| --------------- | ----- | ------------------------------------------------------------------ |
| `min-instances` | `0`   | Scale to zero when idle — no always-on compute bill                |
| `max-instances` | `1`   | One container holds all session/diagram/MCP state (no split-brain) |

Deploy scripts and CI default to this pair. Override with `MIN_INSTANCES` / `MAX_INSTANCES` env vars on manual deploys.

**UX:** When the shell loads, the web app polls `/api/health` and shows branded cold-start copy instead of a blank wait. If Google Frontend returns plain **`Rate exceeded.`** before `index.html` arrives, refresh once — a service-worker fallback (after a prior successful visit) can show the same gate on later cold starts.

**If 429s persist while an instance should be up**, check logs (unlikely with `max-instances=1` unless the lone container is saturated by long **`session-events`** SSE connections):

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="mermaid-gen-main" AND httpRequest.status=429' \
  --limit=10 --freshness=1h --project=PROJECT_ID
```

**Alternative (cost vs convenience):** `--min-instances=1` avoids cold starts entirely but bills for a warm container 24/7.

**GitHub Actions `Deploy Cloud Run` fails at `docker push` with billing disabled:**

```
denied: This API method requires billing to be enabled. Please enable billing on project #…
```

The Docker image **builds successfully**; Artifact Registry and Cloud Run require an active billing account on the project. This is **not** caused by application code — CI still passes. Recent merges (for example PRs #91–#93) can all fail deploy with the same message when billing is unlinked or suspended.

1. Open [Enable billing for the project](https://console.developers.google.com/billing/enable?project=464241135431) (project `mermaidgen`, number `464241135431`).
2. Link the billing account that holds your credits (**Billing → Manage billing account → My projects**).
3. Verify:

   ```bash
   gcloud billing projects describe mermaidgen
   # billingEnabled: True
   ```

4. Re-run deploy: **Actions → Deploy Cloud Run → Run workflow** (or push an empty commit to `main`).

Preflight (local or CI): [`scripts/verify-gcp-billing.sh`](../../scripts/verify-gcp-billing.sh) — wired into [`.github/workflows/deploy-cloud-run.yml`](../../.github/workflows/deploy-cloud-run.yml) before the image build so failures surface in ~10s instead of after a multi-minute Docker build. The deploy service account may lack `billing.viewer`; in that case the script falls back to an Artifact Registry probe and only fails when billing is explicitly disabled or billable APIs are unreachable.

**`gcloud builds submit` PERMISSION_DENIED:** Your Google account needs permission to run Cloud Build and push to Artifact Registry (often **Cloud Build Editor**, **Run Admin**, **Artifact Registry Writer**, and Storage access for the Cloud Build source bucket). Ask a project owner to grant those roles, or build and push locally with Docker then deploy only the image:

```bash
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/mermaid-gen/web:latest .
docker push us-central1-docker.pkg.dev/PROJECT_ID/mermaid-gen/web:latest
gcloud run deploy mermaid-gen --region=us-central1 --image=us-central1-docker.pkg.dev/PROJECT_ID/mermaid-gen/web:latest --allow-unauthenticated --port=8080
```
