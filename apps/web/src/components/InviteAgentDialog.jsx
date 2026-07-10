import { useEffect, useState } from 'react';
import { fetchInvite, rotatePairingCode } from '../state/sessionEventsClient.js';

export default function InviteAgentDialog({ sessionId, open, onClose }) {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchInvite({ sessionId })
      .then((data) => {
        if (!cancelled) setInvite(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load invite.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  if (!open) return null;

  async function copy(label, text) {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // clipboard API can fail in non-secure contexts; user can copy manually.
    }
  }

  async function handleRotateCode() {
    if (!sessionId) return;
    setRotating(true);
    setError(null);
    try {
      const result = await rotatePairingCode({ sessionId });
      setInvite((prev) => (prev ? { ...prev, pairingCode: result.pairingCode } : prev));
    } catch (err) {
      setError(err?.message ?? 'Failed to rotate pairing code.');
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="invite-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <div className="invite-card">
        <header className="invite-header">
          <div className="invite-header-titlebar">
            <span className="invite-header-emoji" aria-hidden="true">
              🤝
            </span>
            <div className="invite-header-text">
              <h2 id="invite-title">Onboard an external agent</h2>
              <p className="invite-header-subtitle">
                Bring another LLM into the Co-Design roundtable.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="overlay-button compact-button invite-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </header>
        <p className="invite-explainer">
          External agents join over <strong>MCP</strong> — they can see the diagram, propose
          changes, and weigh in alongside the Stakeholders. <strong>Scan the QR</strong> or hit{' '}
          <strong>Connect now</strong> to pair an IDE-side agent in one tap; you’ll still approve
          the handshake before anyone touches the slop. For a long-lived setup, use the stable URL
          under Advanced.
        </p>
        {loading ? <p>Loading invite…</p> : null}
        {error ? <p className="invite-error">{error}</p> : null}
        {invite ? (
          <div className="invite-content">
            {invite.qrDataUrl ? (
              <section className="invite-section invite-qr-section invite-qr-primary">
                <h3>Scan to connect</h3>
                <img
                  src={invite.qrDataUrl}
                  alt="QR code for MCP pairing URL"
                  className="invite-qr"
                />
              </section>
            ) : null}

            <section className="invite-section invite-install-actions">
              <h3>Connect now</h3>
              <div className="invite-install-buttons">
                {invite.cursorInstallUrlWithPairing ? (
                  <a
                    href={invite.cursorInstallUrlWithPairing}
                    className="overlay-button invite-install-button invite-install-cursor"
                  >
                    <span className="invite-install-button-prefix">Connect</span>
                    <span className="invite-install-button-target">Cursor</span>
                  </a>
                ) : null}
                {invite.vscodeInstallUrlWithPairing ? (
                  <a
                    href={invite.vscodeInstallUrlWithPairing}
                    className="overlay-button invite-install-button invite-install-vscode"
                  >
                    <span className="invite-install-button-prefix">Connect</span>
                    <span className="invite-install-button-target">VS Code</span>
                  </a>
                ) : null}
                {invite.claudeCodeCommandWithPairing ? (
                  <button
                    type="button"
                    className="overlay-button invite-install-button invite-install-secondary"
                    onClick={() => copy('cli-pair', invite.claudeCodeCommandWithPairing)}
                  >
                    {copied === 'cli-pair' ? (
                      <span className="invite-install-button-target">Copied!</span>
                    ) : (
                      <>
                        <span className="invite-install-button-prefix">Copy</span>
                        <span className="invite-install-button-target">Claude CLI</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </section>

            <section className="invite-section">
              <h3>Pairing code</h3>
              <div className="invite-pairing-row">
                <span className="invite-pairing-code" aria-label="Pairing code">
                  {invite.pairingCode}
                </span>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  onClick={() => copy('pairing', invite.pairingCode)}
                >
                  {copied === 'pairing' ? 'Copied!' : 'Copy code'}
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  onClick={handleRotateCode}
                  disabled={rotating}
                >
                  {rotating ? 'Rotating…' : 'Rotate code'}
                </button>
              </div>
            </section>

            <section className="invite-section invite-advanced-toggle">
              <button
                type="button"
                className="overlay-button compact-button invite-advanced-button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? 'Hide' : 'Show'} stable MCP URL & legacy options
              </button>
            </section>

            {showAdvanced ? (
              <div className="invite-advanced">
                <section className="invite-section">
                  <h3>Stable MCP URL (configure once)</h3>
                  <div className="invite-row">
                    <code className="invite-url">{invite.stableMcpUrl}</code>
                    <button
                      type="button"
                      className="overlay-button compact-button"
                      onClick={() => copy('stable', invite.stableMcpUrl)}
                    >
                      {copied === 'stable' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </section>

                {invite.cursorInstallUrl ? (
                  <section className="invite-section">
                    <h3>Add to Cursor (stable)</h3>
                    <a
                      href={invite.cursorInstallUrl}
                      className="overlay-button invite-install-button invite-install-secondary"
                    >
                      Add to Cursor
                    </a>
                  </section>
                ) : null}

                {invite.claudeCodeCommand ? (
                  <section className="invite-section">
                    <h3>Claude Code (stable URL)</h3>
                    <div className="invite-row">
                      <code className="invite-cli">{invite.claudeCodeCommand}</code>
                      <button
                        type="button"
                        className="overlay-button compact-button"
                        onClick={() => copy('cli', invite.claudeCodeCommand)}
                      >
                        {copied === 'cli' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="invite-section">
                  <h3>Session MCP URL (legacy)</h3>
                  <div className="invite-row">
                    <code className="invite-url">{invite.mcpUrl}</code>
                    <button
                      type="button"
                      className="overlay-button compact-button"
                      onClick={() => copy('url', invite.mcpUrl)}
                    >
                      {copied === 'url' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
