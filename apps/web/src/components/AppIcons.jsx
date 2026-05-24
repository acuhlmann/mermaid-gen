/**
 * Inline SVG icons used by the App shell. Each is a stateless component with
 * `aria-hidden` so screen readers skip the glyph; pair with text labels for a11y.
 */

export function ButtonIcon({ children }) {
  return (
    <span className="button-icon" aria-hidden="true">
      {children}
    </span>
  );
}

export function ArchiSlopMarkIcon() {
  // viewBox tightened to the actual helmet+grass silhouette so the surrounding
  // brand-control pill doesn't render visible whitespace around the logo.
  return (
    <svg className="brand-helmet-svg" viewBox="4.5 5.4 15 18.4" width="36" height="36" aria-hidden="true">
      <path d="M5 16 Q5 7 12 6 Q19 7 19 16 Z" fill="#F4A300" />
      <ellipse cx="12" cy="16" rx="9" ry="1.4" fill="#C77A00" />
      <path d="M12 6 L11 16 L13 16 Z" fill="#C77A00" opacity="0.55" />
      <path d="M6 17 Q6 20 7 22 Q8 20 8 17 Z" fill="#7CFC00" />
      <path d="M11 17 Q11 22 12 23.5 Q13 22 13 17 Z" fill="#3FA700" />
      <path d="M16 17 Q16 20 17 22 Q18 20 18 17 Z" fill="#7CFC00" />
    </svg>
  );
}

export function PromptIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-8.5l-4.7 3.5c-.7.5-1.7 0-1.7-.9V18H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm3 5v1.6h10V9H7zm0 3.2v1.6h7v-1.6H7z"
      />
    </svg>
  );
}

export function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M8.5 3.4c-1.7 0-3 1.2-3 2.7 0 .3 0 .6.1.9-1.2.4-2.1 1.5-2.1 2.8 0 .8.3 1.5.8 2-.5.5-.8 1.2-.8 2 0 1.4 1 2.5 2.3 2.8.1 1.4 1.3 2.5 2.7 2.5.8 0 1.5-.3 2-.9V4.3c-.5-.5-1.2-.9-2-.9Zm7 0c-.8 0-1.5.4-2 .9v14c.5.5 1.2.9 2 .9 1.4 0 2.6-1.1 2.7-2.5 1.3-.3 2.3-1.4 2.3-2.8 0-.8-.3-1.5-.8-2 .5-.5.8-1.2.8-2 0-1.3-.9-2.4-2.1-2.8.1-.3.1-.6.1-.9 0-1.5-1.3-2.7-3-2.7Z"
        fill="#ff5fb0"
        stroke="#1f1235"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 7.5c.6.2 1 .6 1.2 1.2M8.2 11.2c.7 0 1.3.3 1.6.8M9.4 15.2c.5-.3 1-.4 1.5-.3M14.5 7.5c-.6.2-1 .6-1.2 1.2M15.8 11.2c-.7 0-1.3.3-1.6.8M14.6 15.2c-.5-.3-1-.4-1.5-.3M12 4.5v15"
        fill="none"
        stroke="#1f1235"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
      />
    </svg>
  );
}

export function MicActiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}

export function SettingsGearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.62.06-.94 0-.32-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0 0 13.91 2h-3.84a.48.48 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.485.485 0 0 0-.59.22L2.71 8.48a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94 0 .32.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.39.31.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.27.42.49.42h3.84c.24 0 .44-.18.48-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.09.49 0 .61-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4a3.6 3.6 0 0 1 3.6 3.6 3.6 3.6 0 0 1-3.6 3.6z"
      />
    </svg>
  );
}

/** Insights / Thinking pane — prose panel with a sparkle (agent deep-dive). */
export function ThinkingPanelIcon() {
  return (
    <svg className="shell-control-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 4.75h9.2c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75H6A1.75 1.75 0 0 1 4.25 17V6.5C4.25 5.53 5.03 4.75 6 4.75z"
        opacity="0.18"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        d="M6 5.25h8.7c.69 0 1.25.56 1.25 1.25v9.5c0 .69-.56 1.25-1.25 1.25H6A1.25 1.25 0 0 1 4.75 15V6.5c0-.69.56-1.25 1.25-1.25z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        d="M7.6 9.1h6.8M7.6 12h5.4M7.6 14.9h3.6"
      />
      <path
        fill="currentColor"
        d="m16.85 6.1.55 1.25 1.35.2-.98.95.23 1.35-1.15-.6-1.15.6.23-1.35-.98-.95 1.35-.2.55-1.25z"
      />
    </svg>
  );
}

/** Collapse the Thinking pane (chevron tucks the side panel away). */
export function ThinkingPanelCloseIcon() {
  return (
    <svg className="shell-control-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 7.5 13.5 12l-5.25 4.5M15.75 5.25v13.5"
      />
    </svg>
  );
}

/** Monaco / diagram source editor. */
export function CodeEditorIcon() {
  return (
    <svg className="shell-control-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 8.25 5 12l3.25 3.75M15.75 8.25 19 12l-3.25 3.75M13.6 7.2l-3.2 9.6"
      />
    </svg>
  );
}

export function CodeCloseIcon() {
  return (
    <svg className="shell-control-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        d="M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5"
      />
    </svg>
  );
}
