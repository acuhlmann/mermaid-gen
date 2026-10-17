/**
 * `GET /api/god/status` — the owner's read view of ArchiSlop God's ticks (ADR-0019 §10, stage 2c).
 *
 * Answers "is God running, what did it last do, why did it stop, and how close was it?" from the
 * `god-log` rollup, without anyone opening a CI log. Read-only: the settings half of the window
 * writes GitHub Actions variables through a narrow token that does not exist yet, and ship is a
 * later playbook change.
 *
 * The door-code gate (`createVisitorBadgeGate`, mounted before every router in `loadServerApp.js`)
 * is what keeps this owner-only — including the spend figures. `Cache-Control: no-store`, because a
 * stale answer about money and autonomy is worse than a slow one.
 */
import express, { type Request, type Response } from 'express';
import { getGodStatusView, type GodStatusView } from '../god/godLogView.js';

type Env = Record<string, string | undefined>;

export type GodStatusRouterOptions = {
  env?: Env;
  /** Test seam: where the view comes from. Defaults to the cached `god-log` read. */
  load?: (options: { env: Env }) => Promise<GodStatusView>;
  nowMs?: () => number;
};

export function createGodStatusRouter({
  env = process.env,
  load = ({ env: inner }) => getGodStatusView({ env: inner }),
  nowMs = () => Date.now()
}: GodStatusRouterOptions = {}) {
  const router = express.Router();

  router.get('/status', async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const view = await load({ env });
      // `none` means nothing could be read at all: an error the window can show, not an empty month.
      res.status(view.source === 'none' ? 503 : 200).json(view);
    } catch {
      // The view swallows its own failures, so reaching here is a bug, not a bad network. Say only
      // that: no stack, no message, nothing a public repo's log has to learn from.
      res.status(503).json({
        v: 1,
        generatedAt: new Date(nowMs()).toISOString(),
        source: 'none',
        issues: ['fetch_failed']
      });
    }
  });

  return router;
}
