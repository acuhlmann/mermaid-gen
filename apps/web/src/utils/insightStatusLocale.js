/**
 * Maps canonical English status strings (from the server or client fallbacks)
 * to `controls.insights.nowStatus` keys for locale substitution.
 */
export const INSIGHT_NOW_STATUS_ALIASES = {
  'Repairing diagram syntax…': 'repairingSyntax',
  'Repairing diagram syntax...': 'repairingSyntax',
  'Still working…': 'stillWorking',
  'Still working...': 'stillWorking',
  'Thinking…': 'thinking',
  'Thinking...': 'thinking',
  'Applying diagram patch…': 'applyingPatch',
  'Applying diagram patch...': 'applyingPatch',
  'Planning the update…': 'planningUpdate',
  'Planning the update...': 'planningUpdate',
  'Polishing the diagram…': 'polishing',
  'Polishing the diagram...': 'polishing',
  'Restructuring the diagram…': 'restructuring',
  'Restructuring the diagram...': 'restructuring',
  'Reviewing the diagram…': 'reviewing',
  'Reviewing the diagram...': 'reviewing',
  'Explaining the diagram…': 'explaining',
  'Explaining the diagram...': 'explaining',
  'Going off-script…': 'goingOffScript',
  'Going off-script...': 'goingOffScript',
  'Updating visual style…': 'updatingStyle',
  'Updating visual style...': 'updatingStyle',
  'Simplifying for executives…': 'simplifyingExec',
  'Simplifying for executives...': 'simplifyingExec',
  'Working on the diagram…': 'workingOnDiagram',
  'Working on the diagram...': 'workingOnDiagram',
  'Working on your request...': 'workingOnRequest',
  'Working on your request…': 'workingOnRequest'
};

/** @param {string} raw @param {Record<string, string> | undefined} nowStatusCopy */
export function localizeInsightNowStatusText(raw, nowStatusCopy) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || !nowStatusCopy) return trimmed;
  const key = INSIGHT_NOW_STATUS_ALIASES[trimmed];
  if (key && nowStatusCopy[key]) return nowStatusCopy[key];
  return trimmed;
}
