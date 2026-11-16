import { redactSecrets } from '../utils/redactSecrets.js';
import { GOD_LOG_DEFAULT_REPO } from './godLogView.js';
import { sanitizeBranchSlug, type GodPrProposal } from './godPetitionPrompt.js';

type Env = Record<string, string | undefined>;

const REPO_SLUG_RE = /^[\w.-]{1,80}\/[\w.-]{1,80}$/;
const BASE_BRANCH_RE = /^[A-Za-z0-9._/-]{1,80}$/;
const GITHUB_TIMEOUT_MS = 12_000;
export const GOD_WORKFLOW_FILE = 'god.yml';
export const GOD_WORKFLOW_FOCUSES = [
  'any',
  'ux',
  'mermaid',
  'infographic',
  'metaphor3d',
  'chart',
  'forms',
  'anything'
] as const;
export type GodWorkflowFocus = (typeof GOD_WORKFLOW_FOCUSES)[number];

export function resolvePetitionGitHubToken(env: Env = process.env): string | null {
  for (const key of ['GOD_PR_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const val = typeof env[key] === 'string' ? env[key].trim() : '';
    if (val) return val;
  }
  return null;
}

export function resolvePetitionRepo(env: Env = process.env): string {
  const raw = (env.GOD_PETITION_REPO ?? env.GOD_LOG_REPO ?? GOD_LOG_DEFAULT_REPO).trim();
  return REPO_SLUG_RE.test(raw) ? raw : GOD_LOG_DEFAULT_REPO;
}

export function resolvePetitionBaseBranch(env: Env = process.env): string {
  const raw = (env.GOD_PETITION_BASE_BRANCH ?? 'main').trim();
  return BASE_BRANCH_RE.test(raw) && !raw.includes('..') ? raw : 'main';
}

const FOCUS_PATTERNS: ReadonlyArray<{ focus: GodWorkflowFocus; re: RegExp }> = [
  { focus: 'mermaid', re: /\b(?:mermaid|flowchart|sequence|state\s+diagram|er\s*diagram)s?\b/i },
  { focus: 'infographic', re: /\b(?:infographic|antv)s?\b/i },
  { focus: 'metaphor3d', re: /\b(?:metaphor|3d|three\.js)s?\b/i },
  { focus: 'chart', re: /\b(?:chart|vega(?:-lite)?|flint|echarts|plotly)s?\b/i },
  { focus: 'forms', re: /\b(?:forms?|a2ui)\b/i },
  { focus: 'anything', re: /\b(?:anything|html|sandbox(?:es)?)\b/i },
  {
    focus: 'ux',
    re: /\b(?:ux|ui|studio|office|buttons?|hotkeys?|shortcuts?|themes?|dark\s*mode|apps\/web)\b/i
  }
];

export function inferGodWorkflowFocus(proposal: Partial<GodPrProposal>): GodWorkflowFocus {
  const haystack = `${proposal.targetArea ?? ''} ${proposal.title ?? ''} ${proposal.summary ?? ''}`;
  const matched = FOCUS_PATTERNS.find((entry) => entry.re.test(haystack));
  return matched ? matched.focus : 'any';
}

export function buildManualWorkflowCommand(input: {
  repo: string;
  ref: string;
  focus: GodWorkflowFocus;
}): string {
  const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
  return `gh workflow run ${GOD_WORKFLOW_FILE} --repo ${q(input.repo)} --ref ${q(input.ref)} -f tier=propose -f focus=${input.focus} -f force=true`;
}

export function buildPetitionSpecMarkdown(input: {
  proposal: GodPrProposal;
  prayerSummary?: string;
  favor: number;
  userName?: string;
  createdAt: string;
}): string {
  const mortal = input.userName?.trim() || 'Unnamed Mortal';
  const planLines = input.proposal.implementationPlan.map((step, i) => `${i + 1}. ${step}`);
  const sections = [
    `# Divine Petition: ${input.proposal.title}`,
    '',
    `- **Petitioner:** ${mortal}`,
    `- **Divine Favor:** ${input.favor}/100`,
    `- **Target Area:** \`${input.proposal.targetArea}\``,
    `- **Decreed At:** ${input.createdAt}`,
    '',
    '## Celestial Mandate',
    '',
    input.proposal.summary,
    '',
    '## Implementation Plan',
    '',
    ...planLines
  ];

  if (input.prayerSummary?.trim()) {
    sections.push(
      '',
      '## Mortal Prayer Excerpt',
      '',
      `> ${input.prayerSummary.trim().slice(0, 500)}`
    );
  }

  sections.push('', '## Benediction', '', `_${input.proposal.divineBlessing}_`, '');
  return sections.join('\n');
}

export function buildPetitionPrBody(input: {
  proposal: GodPrProposal;
  prayerSummary?: string;
  favor: number;
  userName?: string;
  filePath: string;
}): string {
  const mortal = input.userName?.trim() || 'Unnamed Mortal';
  const plan = input.proposal.implementationPlan.map((s) => `- [ ] ${s}`).join('\n');
  const lines = [
    '## Decree of the ArchiSlop God',
    '',
    `Petitioner **${mortal}** approached the Altar (Divine Favor: **${input.favor}/100**) and was judged worthy of a branch.`,
    '',
    '### Summary',
    input.proposal.summary,
    '',
    '### Target Area',
    `\`${input.proposal.targetArea}\``,
    '',
    '### Sacred Implementation Plan',
    plan,
    '',
    '### Petition Artifact',
    `Recorded in \`${input.filePath}\`.`
  ];
  if (input.prayerSummary?.trim()) {
    lines.push('', '### Prayer Excerpt', `> ${input.prayerSummary.trim().slice(0, 400)}`);
  }
  lines.push('', `> _"${input.proposal.divineBlessing}"_`);
  return lines.join('\n');
}

export function buildManualGhCommand(input: {
  repo: string;
  baseBranch: string;
  branch: string;
  title: string;
  filePath: string;
  markdown: string;
}): string {
  const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
  const contentB64 = Buffer.from(input.markdown, 'utf8').toString('base64');
  return [
    `git checkout -b ${q(input.branch)} ${q(`origin/${input.baseBranch}`)}`,
    `mkdir -p "$(dirname ${q(input.filePath)})"`,
    `node -e 'require("node:fs").writeFileSync(process.argv[1], Buffer.from(process.argv[2], "base64"))' ${q(input.filePath)} ${q(contentB64)}`,
    `git add ${q(input.filePath)}`,
    `git commit -m ${q(input.title)}`,
    `git push -u origin ${q(input.branch)}`,
    `gh pr create --repo ${q(input.repo)} --base ${q(input.baseBranch)} --head ${q(input.branch)} --title ${q(input.title)}`
  ].join(' && ');
}

export type GodWorkflowDispatchResult = {
  attempted: boolean;
  dispatched: boolean;
  status: 'dispatched' | 'unconfigured' | 'failed' | 'skipped';
  workflow: string;
  ref: string;
  focus: GodWorkflowFocus;
  workflowUrl: string;
  ghWorkflowCommand: string;
  dispatchedAt?: string;
  reason?: string;
  message: string;
};

export type GodWorkflowRunStatusResult = {
  available: boolean;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'unknown' | 'unconfigured' | 'error';
  conclusion: string | null;
  runId?: number;
  runNumber?: number;
  headBranch?: string;
  updatedAt?: string;
  htmlUrl: string;
  message: string;
};

export type GodPrActionResult = {
  filed: boolean;
  mode: 'github_pr' | 'unconfigured' | 'github_error';
  reason?: string;
  repo: string;
  baseBranch: string;
  branch: string;
  filePath: string;
  title: string;
  body: string;
  prNumber?: number;
  prUrl?: string;
  ghCommand: string;
  divineMessage: string;
  workflowDispatch: GodWorkflowDispatchResult;
};

async function githubJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  init: Parameters<typeof fetch>[1] = {}
): Promise<{ ok: true; data: T } | { ok: false; status: number; detail: string }> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'archislop-god-altar',
      ...(init.headers ?? {})
    },
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS)
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: redactSecrets(text.slice(0, 300))
    };
  }
  if (response.status === 204 || !text.trim()) {
    return { ok: true, data: {} as T };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: response.status, detail: 'Invalid JSON from GitHub API' };
  }
}

export type DispatchPetitionWorkflowOptions = {
  repo?: string;
  ref: string;
  fallbackRef?: string;
  focus: GodWorkflowFocus;
  env?: Env;
  fetchImpl?: typeof fetch;
};

function makeWorkflowDispatchBase(repo: string, ref: string, focus: GodWorkflowFocus) {
  return {
    workflow: GOD_WORKFLOW_FILE,
    ref,
    focus,
    workflowUrl: `https://github.com/${repo}/actions/workflows/${GOD_WORKFLOW_FILE}`,
    ghWorkflowCommand: buildManualWorkflowCommand({ repo, ref, focus })
  };
}

function shouldFallbackRef(status: number, options: DispatchPetitionWorkflowOptions): boolean {
  return Boolean(
    (status === 422 || status === 404) && options.fallbackRef && options.fallbackRef !== options.ref
  );
}

export async function dispatchPetitionWorkflow(
  options: DispatchPetitionWorkflowOptions
): Promise<GodWorkflowDispatchResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const repo =
    options.repo && REPO_SLUG_RE.test(options.repo) ? options.repo : resolvePetitionRepo(env);
  const base = makeWorkflowDispatchBase(repo, options.ref, options.focus);
  const token = resolvePetitionGitHubToken(env);

  if (!token) {
    return {
      ...base,
      attempted: false,
      dispatched: false,
      status: 'unconfigured',
      reason: 'missing_github_token',
      message:
        'No GitHub token is configured on this server; dispatch god.yml manually with the gh command below.'
    };
  }

  const endpoint = `https://api.github.com/repos/${repo}/actions/workflows/${GOD_WORKFLOW_FILE}/dispatches`;
  const postDispatch = (ref: string) =>
    githubJson<Record<string, never>>(fetchImpl, endpoint, token, {
      method: 'POST',
      body: JSON.stringify({
        ref,
        inputs: {
          spike: 'false',
          force: 'true',
          tier: 'propose',
          focus: options.focus
        }
      })
    });

  let activeRef = options.ref;
  let dispatchRes:
    { ok: true; data: Record<string, never> } | { ok: false; status: number; detail: string };
  try {
    dispatchRes = await postDispatch(activeRef);
    if (dispatchRes.ok === false && shouldFallbackRef(dispatchRes.status, options)) {
      activeRef = options.fallbackRef ?? activeRef;
      dispatchRes = await postDispatch(activeRef);
    }
  } catch (error) {
    const detail = redactSecrets(error instanceof Error ? error.message : String(error));
    return {
      ...makeWorkflowDispatchBase(repo, activeRef, options.focus),
      attempted: true,
      dispatched: false,
      status: 'failed',
      reason: 'dispatch_exception',
      message: `GitHub workflow_dispatch threw (${detail}). Run the gh workflow command below instead.`
    };
  }

  const finalBase = makeWorkflowDispatchBase(repo, activeRef, options.focus);
  if (dispatchRes.ok === false) {
    return {
      ...finalBase,
      attempted: true,
      dispatched: false,
      status: 'failed',
      reason: `dispatch_${dispatchRes.status}`,
      message: `GitHub refused workflow_dispatch (${dispatchRes.status}: ${dispatchRes.detail}). Run the gh workflow command below instead.`
    };
  }

  return {
    ...finalBase,
    attempted: true,
    dispatched: true,
    status: 'dispatched',
    dispatchedAt: new Date().toISOString(),
    message: `Dispatched ${GOD_WORKFLOW_FILE} on ${activeRef} (tier: propose, focus: ${options.focus}) so God's harness can implement the decree.`
  };
}

type GitHubWorkflowRunRow = {
  id?: number;
  run_number?: number;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  head_branch?: string;
  event?: string;
  created_at?: string;
  updated_at?: string;
};

function normalizeWorkflowRunStatus(raw: string | undefined): GodWorkflowRunStatusResult['status'] {
  if (raw === 'queued' || raw === 'in_progress' || raw === 'completed' || raw === 'waiting') {
    return raw;
  }
  return 'unknown';
}

function pickMatchingWorkflowRun(
  runs: GitHubWorkflowRunRow[],
  since?: string
): GitHubWorkflowRunRow | null {
  const sinceMs = since ? Date.parse(since) : Number.NaN;
  const found = runs.find((run) => {
    if (!Number.isFinite(sinceMs) || !run.created_at) return true;
    const createdMs = Date.parse(run.created_at);
    return !Number.isFinite(createdMs) || createdMs >= sinceMs - 60_000;
  });
  return found ?? null;
}

function formatWorkflowRunStatus(
  matching: GitHubWorkflowRunRow | null,
  workflowUrl: string
): GodWorkflowRunStatusResult {
  if (!matching) {
    return {
      available: true,
      status: 'queued',
      conclusion: null,
      htmlUrl: workflowUrl,
      message: `Waiting for GitHub Actions to index the dispatched ${GOD_WORKFLOW_FILE} run.`
    };
  }
  const status = normalizeWorkflowRunStatus(matching.status);
  const conclusion = matching.conclusion ?? null;
  const runLabel = matching.run_number ? `#${matching.run_number}` : '';
  const suffix = conclusion ? ` (${conclusion})` : '';
  return {
    available: true,
    status,
    conclusion,
    runId: matching.id,
    runNumber: matching.run_number,
    headBranch: matching.head_branch,
    updatedAt: matching.updated_at,
    htmlUrl: matching.html_url || workflowUrl,
    message: `${GOD_WORKFLOW_FILE} ${runLabel}: ${status}${suffix}.`
  };
}

export async function getPetitionWorkflowStatus(
  options: {
    repo?: string;
    ref?: string;
    since?: string;
    env?: Env;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<GodWorkflowRunStatusResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const repo =
    options.repo && REPO_SLUG_RE.test(options.repo) ? options.repo : resolvePetitionRepo(env);
  const workflowUrl = `https://github.com/${repo}/actions/workflows/${GOD_WORKFLOW_FILE}`;
  const token = resolvePetitionGitHubToken(env);

  if (!token) {
    return {
      available: false,
      status: 'unconfigured',
      conclusion: null,
      htmlUrl: workflowUrl,
      message: 'No GitHub token is configured on this server to poll workflow runs.'
    };
  }

  const branchParam = options.ref ? `&branch=${encodeURIComponent(options.ref)}` : '';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${GOD_WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=10${branchParam}`;

  try {
    const res = await githubJson<{ workflow_runs?: GitHubWorkflowRunRow[] }>(fetchImpl, url, token);
    if (res.ok === false) {
      return {
        available: false,
        status: 'error',
        conclusion: null,
        htmlUrl: workflowUrl,
        message: `GitHub refused workflow status query (${res.status}: ${res.detail}).`
      };
    }
    const runs = Array.isArray(res.data.workflow_runs) ? res.data.workflow_runs : [];
    return formatWorkflowRunStatus(pickMatchingWorkflowRun(runs, options.since), workflowUrl);
  } catch (error) {
    const detail = redactSecrets(error instanceof Error ? error.message : String(error));
    return {
      available: false,
      status: 'error',
      conclusion: null,
      htmlUrl: workflowUrl,
      message: `Failed checking ${GOD_WORKFLOW_FILE} status (${detail}).`
    };
  }
}

export type FilePetitionPrOptions = {
  proposal: GodPrProposal;
  prayerSummary?: string;
  favor: number;
  userName?: string;
  dispatchWorkflow?: boolean;
  env?: Env;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
};

type PreparedPrContext = {
  repo: string;
  baseBranch: string;
  branch: string;
  filePath: string;
  title: string;
  body: string;
  ghCommand: string;
  markdown: string;
  focus: GodWorkflowFocus;
  dispatchWorkflow: boolean;
};

function prFailure(
  ctx: PreparedPrContext,
  reason: string,
  divineMessage: string
): GodPrActionResult {
  const base = makeWorkflowDispatchBase(ctx.repo, ctx.branch, ctx.focus);
  return {
    filed: false,
    mode: 'github_error',
    reason,
    repo: ctx.repo,
    baseBranch: ctx.baseBranch,
    branch: ctx.branch,
    filePath: ctx.filePath,
    title: ctx.title,
    body: ctx.body,
    ghCommand: ctx.ghCommand,
    divineMessage,
    workflowDispatch: {
      ...base,
      attempted: false,
      dispatched: false,
      status: 'skipped',
      reason: 'pr_not_opened',
      message: 'Workflow dispatch skipped because the PR branch did not finish opening.'
    }
  };
}

async function resolveWorkflowAfterPr(
  fetchImpl: typeof fetch,
  env: Env,
  ctx: PreparedPrContext
): Promise<GodWorkflowDispatchResult> {
  if (!ctx.dispatchWorkflow) {
    return {
      ...makeWorkflowDispatchBase(ctx.repo, ctx.branch, ctx.focus),
      attempted: false,
      dispatched: false,
      status: 'skipped',
      reason: 'dispatch_disabled',
      message: 'Workflow dispatch was left unchecked; trigger god.yml manually if desired.'
    };
  }
  return dispatchPetitionWorkflow({
    repo: ctx.repo,
    ref: ctx.branch,
    fallbackRef: ctx.baseBranch,
    focus: ctx.focus,
    env,
    fetchImpl
  });
}

async function createPrOnGitHub(
  fetchImpl: typeof fetch,
  token: string,
  env: Env,
  ctx: PreparedPrContext
): Promise<GodPrActionResult> {
  const baseApi = `https://api.github.com/repos/${ctx.repo}`;
  const refRes = await githubJson<{ object?: { sha?: string } }>(
    fetchImpl,
    `${baseApi}/git/ref/heads/${encodeURIComponent(ctx.baseBranch)}`,
    token
  );
  if (refRes.ok === false) {
    return prFailure(
      ctx,
      `git_ref_${refRes.status}`,
      `THE CELESTIAL FORGE STUMBLED READING \`${ctx.baseBranch}\`: ${refRes.detail}.`
    );
  }
  const baseSha = refRes.data.object?.sha;
  if (!baseSha) {
    return prFailure(ctx, 'missing_base_sha', `No base SHA returned for \`${ctx.baseBranch}\`.`);
  }

  const createRef = await githubJson<unknown>(fetchImpl, `${baseApi}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${ctx.branch}`, sha: baseSha })
  });
  if (createRef.ok === false) {
    return prFailure(
      ctx,
      `create_ref_${createRef.status}`,
      `GITHUB REFUSED TO BIRTH BRANCH \`${ctx.branch}\`: ${createRef.detail}`
    );
  }

  const putFile = await githubJson<unknown>(
    fetchImpl,
    `${baseApi}/contents/${ctx.filePath}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: ctx.title,
        content: Buffer.from(ctx.markdown, 'utf8').toString('base64'),
        branch: ctx.branch
      })
    }
  );
  if (putFile.ok === false) {
    return prFailure(
      ctx,
      `put_file_${putFile.status}`,
      `THE BRANCH OPENED, YET INSCRIBING \`${ctx.filePath}\` FAILED: ${putFile.detail}`
    );
  }

  const prRes = await githubJson<{ number?: number; html_url?: string }>(
    fetchImpl,
    `${baseApi}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title: ctx.title,
        head: ctx.branch,
        base: ctx.baseBranch,
        body: ctx.body
      })
    }
  );
  if (prRes.ok === false) {
    return prFailure(
      ctx,
      `create_pr_${prRes.status}`,
      `THE SACRED COMMIT LANDED, YET OPENING THE PR FAILED: ${prRes.detail}`
    );
  }
  if (!prRes.data.html_url) {
    return prFailure(ctx, 'missing_pr_url', 'GitHub returned no pull request URL.');
  }

  let workflowDispatch: GodWorkflowDispatchResult;
  try {
    workflowDispatch = await resolveWorkflowAfterPr(fetchImpl, env, ctx);
  } catch (error) {
    const detail = redactSecrets(error instanceof Error ? error.message : String(error));
    workflowDispatch = {
      ...makeWorkflowDispatchBase(ctx.repo, ctx.branch, ctx.focus),
      attempted: true,
      dispatched: false,
      status: 'failed',
      reason: 'dispatch_exception',
      message: `Workflow dispatch threw (${detail}). PR was still created; run the gh workflow command below manually.`
    };
  }
  const dispatchNote = workflowDispatch.dispatched
    ? ` ${GOD_WORKFLOW_FILE} hath been dispatched (focus: ${workflowDispatch.focus}) to manifest the code.`
    : '';

  return {
    filed: true,
    mode: 'github_pr',
    repo: ctx.repo,
    baseBranch: ctx.baseBranch,
    branch: ctx.branch,
    filePath: ctx.filePath,
    title: ctx.title,
    body: ctx.body,
    prNumber: prRes.data.number,
    prUrl: prRes.data.html_url,
    ghCommand: ctx.ghCommand,
    divineMessage: `BEHOLD! PR #${String(prRes.data.number ?? '?')} HATH DESCENDED FROM HEAVEN ON BRANCH \`${ctx.branch}\`.${dispatchNote}`,
    workflowDispatch
  };
}

export async function filePetitionPr(options: FilePetitionPrOptions): Promise<GodPrActionResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = new Date((options.nowMs ?? Date.now)());
  const createdAt = now.toISOString();
  const stamp = createdAt.replace(/[-:T]/g, '').slice(0, 14);

  const repo = resolvePetitionRepo(env);
  const baseBranch = resolvePetitionBaseBranch(env);
  const slug = sanitizeBranchSlug(options.proposal.branchSlug || options.proposal.title);
  const branch = `god-petition/${slug}-${stamp}`;
  const filePath = `docs/petitions/${slug}-${stamp}.md`;
  const title = redactSecrets(options.proposal.title.trim().slice(0, 120));
  const focus = inferGodWorkflowFocus(options.proposal);
  const dispatchWorkflow = options.dispatchWorkflow !== false;
  const body = buildPetitionPrBody({
    proposal: options.proposal,
    prayerSummary: options.prayerSummary,
    favor: options.favor,
    userName: options.userName,
    filePath
  });
  const markdown = buildPetitionSpecMarkdown({
    proposal: options.proposal,
    prayerSummary: options.prayerSummary,
    favor: options.favor,
    userName: options.userName,
    createdAt
  });
  const ghCommand = buildManualGhCommand({
    repo,
    baseBranch,
    branch,
    title,
    filePath,
    markdown
  });

  const token = resolvePetitionGitHubToken(env);
  if (!token) {
    const wfBase = makeWorkflowDispatchBase(repo, branch, focus);
    return {
      filed: false,
      mode: 'unconfigured',
      reason: 'missing_github_token',
      repo,
      baseBranch,
      branch,
      filePath,
      title,
      body,
      ghCommand,
      divineMessage:
        'THUNDER ROLLED, YET NO GITHUB TOKEN DWELLS IN THIS SERVER’S ENVIRONMENT (GOD_PR_TOKEN / GITHUB_TOKEN). Behold thy consecrated PR scroll—execute it with thine own mortal hands or bestow a token upon this server.',
      workflowDispatch: {
        ...wfBase,
        attempted: false,
        dispatched: false,
        status: 'unconfigured',
        reason: 'missing_github_token',
        message:
          'No GitHub token is configured on this server; run the gh workflow command below after pushing.'
      }
    };
  }

  return createPrOnGitHub(fetchImpl, token, env, {
    repo,
    baseBranch,
    branch,
    filePath,
    title,
    body,
    ghCommand,
    markdown,
    focus,
    dispatchWorkflow
  });
}
