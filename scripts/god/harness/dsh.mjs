/**
 * DeepSeek Harness adapter for the God runner (ADR-0019).
 *
 * Spawns `dsh --profile headless --patch <god overlay> --json -` in its own process group, feeds
 * the task on stdin, and parses the `--json` event stream. The child's environment is an
 * allowlist: it never inherits the runner's secrets, gets the meter proxy as its DeepSeek
 * endpoint and a per-run proxy token as its "API key", and runs with telemetry disabled.
 *
 * Interface shared by every harness adapter:
 *   start(options) → { pid, exit: Promise<HarnessExit>, kill(signal?) }
 *   HarnessExit = { code, signal, turnEndReason, sawFinal, stderrTail, skippedLines }
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DSH_DIR = path.resolve(HERE, '..', 'dsh');
export const GOD_DSH_PATCH = path.join(DSH_DIR, 'god.patch.yml');

/** The run events dsh documents: lines longer than this are skipped, not parsed. */
const MAX_LINE_BYTES = 32 * 1024;
const STDERR_TAIL_CHARS = 4096;

export function readDshVersions() {
  return JSON.parse(fs.readFileSync(path.join(DSH_DIR, 'versions.json'), 'utf8'));
}

/** The pinned dsh version, for run records. */
export function dshVersion() {
  return readDshVersions().packages['@deepseek-ai/dsh'];
}

/**
 * The child's whole environment. Nothing from `process.env` passes except PATH.
 *
 * @param {{ home: string, permissionMode: string, baseUrl: string, apiKey: string, model: string }} o
 */
export function buildDshEnv({ home, permissionMode, baseUrl, apiKey, model }) {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: home,
    DSH_HOME: path.join(home, '.dsh'),
    LANG: 'C.UTF-8',
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: '1',
    npm_config_update_notifier: 'false',
    DSH_PERMISSION_MODE: permissionMode,
    DSH_TELEMETRY_MODE: 'DISABLED',
    // Belt and braces should the telemetry plugin ever re-enable itself: a dead local address.
    DSH_TELEMETRY_OTLP_URL: 'http://127.0.0.1:9/disabled',
    DEEPSEEK_BASE_URL: baseUrl,
    DEEPSEEK_API_KEY: apiKey,
    GOD_DSH_MODEL: model
  };
}

/** A `turn_end` reason is `{ kind }` in dsh 0.2; accept a bare string too. */
export function turnEndKind(reason) {
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object' && typeof reason.kind === 'string') return reason.kind;
  return 'unknown';
}

/** Split complete NDJSON lines off a buffer; returns the unfinished tail. */
export function drainJsonLines(buffer, onLine, onSkip) {
  const lines = buffer.split('\n');
  const tail = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
      onSkip();
      continue;
    }
    try {
      onLine(JSON.parse(line));
    } catch {
      onSkip();
    }
  }
  return tail;
}

function killGroup(pid, signal) {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // Group already gone.
  }
}

/**
 * Live (non-zombie) members of a process group, from `/proc`; null where `/proc` is unavailable.
 * A zombie has already exited — it only waits for its new parent to reap it, which a container
 * whose PID 1 is not an init may never do — so it is not an orphan doing work.
 */
function liveGroupMembers(pgid) {
  let entries;
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return null;
  }
  const members = [];
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    let stat;
    try {
      stat = fs.readFileSync(`/proc/${name}/stat`, 'utf8');
    } catch {
      continue;
    }
    // `pid (comm) state ppid pgrp …` — comm may hold spaces or parentheses, so split after the last ')'.
    const [state, , pgrp] = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (Number(pgrp) === pgid && state !== 'Z' && state !== 'X') members.push(Number(name));
  }
  return members;
}

/** Whether any process in the group is still running (an orphan after the harness exited). */
export function isProcessGroupAlive(pid) {
  if (!pid) return false;
  const members = liveGroupMembers(pid);
  if (members) return members.length > 0;
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   task: string,
 *   cwd: string,
 *   permissionMode: 'read-only' | 'workspace-write',
 *   baseUrl: string,
 *   apiKey: string,
 *   model: string,
 *   home: string,
 *   onEvent: (raw: Record<string, unknown>) => void,
 *   entry?: string,
 *   installDir?: string,
 *   patchFile?: string,
 *   nodeBin?: string
 * }} options
 */
export function startDsh(options) {
  const versions = readDshVersions();
  const entry = options.entry ?? path.join(options.installDir ?? '', versions.entry);
  const args = [
    entry,
    '--profile',
    versions.profile,
    '--patch',
    options.patchFile ?? GOD_DSH_PATCH,
    '--json',
    '-'
  ];
  fs.mkdirSync(path.join(options.home, '.dsh'), { recursive: true });
  const child = spawn(options.nodeBin ?? process.execPath, args, {
    cwd: options.cwd,
    env: buildDshEnv(options),
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdoutBuffer = '';
  let stderrTail = '';
  let sawFinal = false;
  let turnEndReason = null;
  let skippedLines = 0;

  const onLine = (raw) => {
    if (raw?.type === 'final') sawFinal = true;
    if (raw?.type === 'status' && raw.phase === 'turn_end') turnEndReason = turnEndKind(raw.reason);
    options.onEvent(raw);
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutBuffer = drainJsonLines(stdoutBuffer + chunk, onLine, () => {
      skippedLines += 1;
    });
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL_CHARS);
  });

  child.stdin.on('error', () => {});
  child.stdin.end(options.task);

  const exit = new Promise((resolve) => {
    child.on('error', (error) => {
      stderrTail = `${stderrTail}\nspawn failed: ${error.message}`.slice(-STDERR_TAIL_CHARS);
    });
    child.on('close', (code, signal) => {
      drainJsonLines(`${stdoutBuffer}\n`, onLine, () => {
        skippedLines += 1;
      });
      resolve({ code, signal, turnEndReason, sawFinal, stderrTail, skippedLines });
    });
  });

  return {
    pid: child.pid ?? null,
    exit,
    kill(signal = 'SIGTERM') {
      killGroup(child.pid, signal);
    }
  };
}
