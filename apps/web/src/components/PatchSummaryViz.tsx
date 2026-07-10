/**
 * Visual patch summary (+/− lines sparkbar) for Thinking pane artifacts.
 */

import { PatchLinesBar } from '../utils/thinkingProseEnrich';

export default function PatchSummaryViz({
  revisionId,
  linesAdded = 0,
  linesRemoved = 0
}: {
  revisionId: number;
  linesAdded?: number;
  linesRemoved?: number;
}) {
  const added = Number(linesAdded) || 0;
  const removed = Number(linesRemoved) || 0;
  return (
    <li
      className="insights-patch-summary insights-patch-summary-viz"
      data-testid="patch-summary-viz"
    >
      <span className="insights-patch-summary-rev">
        Revision <strong>{revisionId}</strong>
      </span>
      <PatchLinesBar added={added} removed={removed} keyPrefix={`rev-${revisionId}`} />
    </li>
  );
}
