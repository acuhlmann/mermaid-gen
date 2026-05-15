import { handshakeAppHtml } from './handshakeAppHtml.js';
import { proposalReviewAppHtml } from './proposalReviewAppHtml.js';
import { sessionDashboardAppHtml } from './sessionDashboardAppHtml.js';
import { critiqueMapAppHtml } from './critiqueMapAppHtml.js';
import { sessionPairingAppHtml } from './sessionPairingAppHtml.js';
import { canvasPreviewAppHtml } from './canvasPreviewAppHtml.js';
import { insightsFeedAppHtml } from './insightsFeedAppHtml.js';
import { proposalInboxAppHtml } from './proposalInboxAppHtml.js';
import { sessionEventsAppHtml } from './sessionEventsAppHtml.js';
import { welcomeAppHtml } from './welcomeAppHtml.js';
import { composeInsightAppHtml } from './composeInsightAppHtml.js';
import { focusPickerAppHtml } from './focusPickerAppHtml.js';
import { webCompanionAppHtml } from './webCompanionAppHtml.js';
import {
  MCP_APP_URI_HANDSHAKE,
  MCP_APP_URI_PROPOSAL_REVIEW,
  MCP_APP_URI_SESSION_DASHBOARD,
  MCP_APP_URI_CRITIQUE_MAP,
  MCP_APP_URI_SESSION_PAIRING,
  MCP_APP_URI_CANVAS_PREVIEW,
  MCP_APP_URI_INSIGHTS_FEED,
  MCP_APP_URI_PROPOSAL_INBOX,
  MCP_APP_URI_SESSION_EVENTS,
  MCP_APP_URI_WELCOME,
  MCP_APP_URI_COMPOSE_INSIGHT,
  MCP_APP_URI_FOCUS_PICKER,
  MCP_APP_URI_WEB_COMPANION
} from '../mcpAppUris.js';

/** @type {Record<string, string>} */
export const MCP_APP_HTML_BY_URI = {
  [MCP_APP_URI_HANDSHAKE]: handshakeAppHtml,
  [MCP_APP_URI_PROPOSAL_REVIEW]: proposalReviewAppHtml,
  [MCP_APP_URI_SESSION_DASHBOARD]: sessionDashboardAppHtml,
  [MCP_APP_URI_CRITIQUE_MAP]: critiqueMapAppHtml,
  [MCP_APP_URI_SESSION_PAIRING]: sessionPairingAppHtml,
  [MCP_APP_URI_CANVAS_PREVIEW]: canvasPreviewAppHtml,
  [MCP_APP_URI_INSIGHTS_FEED]: insightsFeedAppHtml,
  [MCP_APP_URI_PROPOSAL_INBOX]: proposalInboxAppHtml,
  [MCP_APP_URI_SESSION_EVENTS]: sessionEventsAppHtml,
  [MCP_APP_URI_WELCOME]: welcomeAppHtml,
  [MCP_APP_URI_COMPOSE_INSIGHT]: composeInsightAppHtml,
  [MCP_APP_URI_FOCUS_PICKER]: focusPickerAppHtml,
  [MCP_APP_URI_WEB_COMPANION]: webCompanionAppHtml
};
