import AgentHandshakeDialog from '../../components/AgentHandshakeDialog.jsx';
import InviteAgentDialog from '../../components/InviteAgentDialog.jsx';

/**
 * External-agent collaboration overlays (handshake approval + invite dialog).
 *
 * @param {{
 *   activeSessionId: string;
 *   pendingHandshake: object | null;
 *   onApproveHandshake: () => void | Promise<void>;
 *   onDenyHandshake: () => void | Promise<void>;
 *   inviteDialogOpen: boolean;
 *   onInviteDialogClose: () => void;
 * }} props
 */
export function SessionCollaborationSlot({
  activeSessionId,
  pendingHandshake,
  onApproveHandshake,
  onDenyHandshake,
  inviteDialogOpen,
  onInviteDialogClose
}) {
  return (
    <>
      <AgentHandshakeDialog
        request={pendingHandshake}
        onApprove={onApproveHandshake}
        onDeny={onDenyHandshake}
      />
      <InviteAgentDialog
        sessionId={activeSessionId}
        open={inviteDialogOpen}
        onClose={onInviteDialogClose}
      />
    </>
  );
}
