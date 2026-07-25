import { useEffect, useState } from 'react';
import { fetchInvite, rotatePairingCode } from '../state/sessionEventsClient.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import {
  overlayFocusHandlers,
  overlayLayerStyle,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';

export default function InviteAgentDialog({ sessionId, open, onClose }) {
  const modalZIndex = useOverlayLayer('invite-agent', open, 'modal');
  const { controls } = useUiCopy();
  const copy = controls.invite;
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
        if (!cancelled) setError(err?.message ?? copy.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, copy.loadFailed]);

  if (!open) return null;

  async function copyText(label, text) {
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
      setError(err?.message ?? copy.rotateFailed);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div
      className="invite-overlay"
      style={overlayLayerStyle(modalZIndex)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
      {...overlayFocusHandlers('invite-agent', open)}
    >
      <div className="invite-card">
        <header className="invite-header">
          <div className="invite-header-titlebar">
            <span className="invite-header-emoji" aria-hidden="true">
              🤝
            </span>
            <div className="invite-header-text">
              <h2 id="invite-title">{copy.title}</h2>
              <p className="invite-header-subtitle">{copy.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="overlay-button compact-button invite-close-button"
            onClick={onClose}
            aria-label={copy.close}
          >
            {copy.close}
          </button>
        </header>
        <p className="invite-explainer">{copy.explainer}</p>
        {loading ? <p>{copy.loading}</p> : null}
        {error ? <p className="invite-error">{error}</p> : null}
        {invite ? (
          <div className="invite-content">
            {invite.qrDataUrl ? (
              <section className="invite-section invite-qr-section invite-qr-primary">
                <h3>{copy.scanToConnect}</h3>
                <img src={invite.qrDataUrl} alt={copy.qrAlt} className="invite-qr" />
              </section>
            ) : null}

            <section className="invite-section invite-install-actions">
              <h3>{copy.connectNow}</h3>
              <div className="invite-install-buttons">
                {invite.cursorInstallUrlWithPairing ? (
                  <a
                    href={invite.cursorInstallUrlWithPairing}
                    className="overlay-button invite-install-button invite-install-cursor"
                  >
                    <span className="invite-install-button-prefix">{copy.connect}</span>
                    <span className="invite-install-button-target">Cursor</span>
                  </a>
                ) : null}
                {invite.vscodeInstallUrlWithPairing ? (
                  <a
                    href={invite.vscodeInstallUrlWithPairing}
                    className="overlay-button invite-install-button invite-install-vscode"
                  >
                    <span className="invite-install-button-prefix">{copy.connect}</span>
                    <span className="invite-install-button-target">VS Code</span>
                  </a>
                ) : null}
                {invite.claudeCodeCommandWithPairing ? (
                  <button
                    type="button"
                    className="overlay-button invite-install-button invite-install-secondary"
                    onClick={() => copyText('cli-pair', invite.claudeCodeCommandWithPairing)}
                  >
                    {copied === 'cli-pair' ? (
                      <span className="invite-install-button-target">{copy.copied}</span>
                    ) : (
                      <>
                        <span className="invite-install-button-prefix">{copy.copy}</span>
                        <span className="invite-install-button-target">Claude CLI</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </section>

            <section className="invite-section">
              <h3>{copy.pairingCode}</h3>
              <div className="invite-pairing-row">
                <span className="invite-pairing-code" aria-label={copy.pairingCodeAria}>
                  {invite.pairingCode}
                </span>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  onClick={() => copyText('pairing', invite.pairingCode)}
                >
                  {copied === 'pairing' ? copy.copied : copy.copyCode}
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  onClick={handleRotateCode}
                  disabled={rotating}
                >
                  {rotating ? copy.rotating : copy.rotateCode}
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
                {showAdvanced ? copy.advancedToggleHide : copy.advancedToggleShow}
              </button>
            </section>

            {showAdvanced ? (
              <div className="invite-advanced">
                <section className="invite-section">
                  <h3>{copy.stableMcpUrl}</h3>
                  <div className="invite-row">
                    <code className="invite-url">{invite.stableMcpUrl}</code>
                    <button
                      type="button"
                      className="overlay-button compact-button"
                      onClick={() => copyText('stable', invite.stableMcpUrl)}
                    >
                      {copied === 'stable' ? copy.copied : copy.copy}
                    </button>
                  </div>
                </section>

                {invite.cursorInstallUrl ? (
                  <section className="invite-section">
                    <h3>{copy.addCursorStable}</h3>
                    <a
                      href={invite.cursorInstallUrl}
                      className="overlay-button invite-install-button invite-install-secondary"
                    >
                      {copy.addToCursor}
                    </a>
                  </section>
                ) : null}

                {invite.claudeCodeCommand ? (
                  <section className="invite-section">
                    <h3>{copy.claudeCodeStable}</h3>
                    <div className="invite-row">
                      <code className="invite-cli">{invite.claudeCodeCommand}</code>
                      <button
                        type="button"
                        className="overlay-button compact-button"
                        onClick={() => copyText('cli', invite.claudeCodeCommand)}
                      >
                        {copied === 'cli' ? copy.copied : copy.copy}
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="invite-section">
                  <h3>{copy.sessionMcpLegacy}</h3>
                  <div className="invite-row">
                    <code className="invite-url">{invite.mcpUrl}</code>
                    <button
                      type="button"
                      className="overlay-button compact-button"
                      onClick={() => copyText('url', invite.mcpUrl)}
                    >
                      {copied === 'url' ? copy.copied : copy.copy}
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
