/**
 * Line-level insert/delete counts between two sources (for AG-UI patch_summary artifacts).
 */
export function computeLineDiffStats(previous, next) {
  const a = typeof previous === 'string' ? previous.split('\n') : [];
  const b = typeof next === 'string' ? next.split('\n') : [];
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      linesRemoved += 1;
      i += 1;
    } else {
      linesAdded += 1;
      j += 1;
    }
  }
  linesRemoved += m - i;
  linesAdded += n - j;
  return { linesAdded, linesRemoved };
}
