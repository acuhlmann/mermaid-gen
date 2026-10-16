import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IntroLocaleToggle from '../../components/IntroLocaleToggle.jsx';
import ErrorToast from '../../components/ErrorToast.jsx';
import DiagramFullscreenButton from '../../components/DiagramFullscreenButton.jsx';
import ViewModeSwitch from '../../components/ViewModeSwitch.jsx';
import { DiagramCanvasSlot } from '../canvas/DiagramCanvasSlot.jsx';
import './SimpleStudio.css';

const FALLBACK_HEADLINE = 'Prompt anything into reality.';

/**
 * Enter submits. Shift+Enter keeps the newline. A confirming Enter from an
 * IME (or Safari's out-of-order compositionend) must not send a half-converted
 * prompt.
 */
function submitOnPlainEnter(event, compositionEndAt) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  if (event.nativeEvent.isComposing || event.isComposing) return;
  const endedAt = compositionEndAt.current;
  if (endedAt != null && Math.abs(event.timeStamp - endedAt) < 50) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

/**
 * One quiet bar on both screens: wordmark, the Simple/Office switch, the
 * language pill, and fullscreen once there is something to fill the screen
 * with. Language used to open as four full rows above the headline — the
 * first thing a newcomer saw was a setting they had not asked about.
 */
function StudioTopBar(props) {
  const { copy, showCanvas } = props;
  return (
    <header className="simple-studio-topbar">
      <p className="simple-studio-wordmark">{copy.wordmark ?? 'archislop'}</p>
      <div className="simple-studio-topbar-actions">
        <ViewModeSwitch
          current="simple"
          label={copy.modeLabel}
          simpleLabel={copy.simpleLabel}
          officeLabel={copy.officeLabel ?? copy.officeCta}
          officeHint={copy.officeHint}
          onSelectOffice={props.onEnterOffice}
        />
        <IntroLocaleToggle
          locale={props.locale}
          copy={props.localeCopy}
          onSelectLocale={props.onSelectLocale}
          variant="menu"
        />
        {showCanvas && props.fullscreenSupported ? (
          <DiagramFullscreenButton
            isFullscreen={Boolean(props.isFullscreen)}
            disabled={Boolean(props.busy)}
            onToggle={props.onToggleFullscreen}
          />
        ) : null}
      </div>
    </header>
  );
}

function StudioResult(props) {
  return (
    <DiagramCanvasSlot
      revisionId={props.revisionId}
      diagramSource={props.diagramSource}
      contentType={props.contentType}
      rendererRefreshKey={props.rendererRefreshKey}
      onManualEdit={props.onManualEdit}
      onValidationChange={props.onValidationChange}
      streamingPreview={props.streamingPreview}
      agentThinkingChrome={false}
      editorOpen={false}
      insightsMounted={false}
      insightsSlot={null}
      selectedNode={null}
      hoverDescriptor={null}
      onSelectedNodeChange={null}
      onHoverTargetChange={null}
      onPanGestureStart={null}
      onNodeToolbarAnchor={null}
      onEditorClose={null}
      changeHighlight={null}
      changeHighlightContentType={null}
      onDiagramSvgRendered={null}
      runFx={null}
      diagramSurfaceRef={props.diagramSurfaceRef}
      isFullscreen={Boolean(props.isFullscreen)}
      onFormSubmit={props.onFormSubmit}
    />
  );
}

/**
 * A small, living slice of the Thinking pane for the wait: what is happening
 * now, the last few plain-language beats, and a clock that proves the run is
 * moving. Subtle on purpose — one quiet card, no pane, no controls — because
 * a first-time user should be watching their thing get made, not learning a
 * second interface while it happens.
 */
function StudioThinkingPeek({ copy, busy, status, lines = [] }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!busy) {
      setElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  if (!busy) return null;
  const heading = copy.creating ?? 'Creating yours…';
  return (
    <div className="simple-studio-peek" data-testid="simple-studio-peek" aria-hidden={false}>
      <p className="simple-studio-peek-heading">
        <span className="simple-studio-peek-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>{heading}</span>
        {elapsedSeconds > 0 ? (
          <span className="simple-studio-peek-elapsed">
            {(copy.elapsed ?? '{seconds}s').replace('{seconds}', String(elapsedSeconds))}
          </span>
        ) : null}
      </p>
      {status ? <p className="simple-studio-peek-status">{status}</p> : null}
      {lines.length > 0 ? (
        <ul className="simple-studio-peek-lines">
          {lines.map((line, index) => (
            <li key={`${index}-${line}`} className={index === lines.length - 1 ? 'is-latest' : ''}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <div className="simple-studio-peek-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

function StudioPromptActions({
  copy,
  busy,
  trimmed,
  stoppable,
  stopLabel,
  onStop,
  showStartOver,
  onStartOver
}) {
  return (
    <div className="simple-studio-actions">
      <button
        type="submit"
        className="simple-studio-go"
        data-testid="simple-studio-go"
        disabled={busy || !trimmed}
      >
        {copy.go ?? 'Go'}
      </button>
      {stoppable ? (
        <button type="button" className="simple-studio-stop" onClick={onStop}>
          {stopLabel}
        </button>
      ) : null}
      {showStartOver ? (
        <button
          type="button"
          className="simple-studio-start"
          data-testid="simple-studio-start-over"
          onClick={onStartOver}
        >
          {copy.startOver ?? 'Start over'}
        </button>
      ) : null}
    </div>
  );
}

function StudioFormatSelect({ copy, modes = [], contentMode = 'auto', onSelectContentMode, busy }) {
  if (modes.length === 0) return null;
  const formatValue = modes.some((mode) => mode.id === contentMode) ? contentMode : 'auto';
  return (
    <label className="simple-studio-format">
      <span>{copy.formatLabel ?? 'Format'}</span>
      <select
        data-testid="simple-studio-format"
        value={formatValue}
        disabled={busy}
        aria-describedby={formatValue === 'auto' ? 'simple-studio-format-hint' : undefined}
        onChange={(event) => onSelectContentMode?.(event.target.value)}
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.label}
          </option>
        ))}
      </select>
      {formatValue === 'auto' ? (
        <span id="simple-studio-format-hint" className="simple-studio-format-hint">
          {copy.formatHint ?? 'Auto picks for you'}
        </span>
      ) : null}
    </label>
  );
}

/**
 * "Rush / Deep" named a mood, not a choice. A newcomer is really picking
 * speed versus care, so the buttons say that — and say it again in smaller
 * type underneath, where it costs nothing once you already know.
 */
function StudioBrainToggle({
  modelProfile = 'fast',
  onSelectModelProfile,
  brainCopy = {},
  busy = false
}) {
  const fastSelected = modelProfile !== 'quality';
  const options = [
    {
      id: 'fast',
      testId: 'simple-studio-brain-fast',
      selected: fastSelected,
      label: brainCopy.fast ?? 'Fast',
      hint: brainCopy.fastHint ?? 'Quick first version',
      profile: 'fast'
    },
    {
      id: 'quality',
      testId: 'simple-studio-brain-quality',
      selected: !fastSelected,
      label: brainCopy.quality ?? 'Thorough',
      hint: brainCopy.qualityHint ?? 'Best quality, a bit slower',
      profile: 'quality'
    }
  ];
  return (
    <div className="simple-studio-brain-wrap">
      <span className="simple-studio-brain-label" id="simple-studio-brain-label">
        {brainCopy.label ?? 'Speed or quality?'}
      </span>
      <div className="simple-studio-brain" role="group" aria-labelledby="simple-studio-brain-label">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            data-testid={option.testId}
            aria-pressed={option.selected}
            className={option.selected ? 'is-selected' : ''}
            disabled={busy}
            onClick={() => onSelectModelProfile?.(option.profile)}
          >
            <span className="simple-studio-brain-option-label">{option.label}</span>
            <span className="simple-studio-brain-option-hint">{option.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StudioTunes(props) {
  return (
    <div className="simple-studio-tunes">
      <StudioFormatSelect {...props} />
      <StudioBrainToggle {...props} />
    </div>
  );
}

function StudioPromptForm(props) {
  const {
    copy,
    headline,
    showCanvas,
    busy,
    status,
    stoppable,
    stopLabel,
    onStop,
    showStartOver,
    onStartOver,
    onSubmit
  } = props;
  const inputRef = useRef(null);
  const compositionEndAt = useRef(null);
  const [prompt, setPrompt] = useState('');
  const trimmed = prompt.trim();

  useEffect(() => {
    if (showCanvas) return undefined;
    const id = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }, 30);
    return () => window.clearTimeout(id);
  }, [showCanvas]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!trimmed || busy) return;
    setPrompt('');
    onSubmit(trimmed);
  }

  return (
    <form
      className={showCanvas ? 'simple-studio-dock' : 'simple-studio-form'}
      onSubmit={handleSubmit}
    >
      <label
        className={showCanvas ? 'sr-only' : 'simple-studio-headline'}
        htmlFor="simple-studio-prompt"
      >
        {headline}
      </label>
      {showCanvas && status && !busy ? (
        <p className="simple-studio-status" role="status" data-testid="simple-studio-status">
          {status}
        </p>
      ) : null}
      <textarea
        ref={inputRef}
        id="simple-studio-prompt"
        className="simple-studio-input"
        data-testid="simple-studio-prompt"
        name="prompt"
        rows={showCanvas ? 2 : 4}
        value={prompt}
        placeholder={copy.placeholder ?? "Describe it. We'll pick the shape."}
        autoComplete="off"
        autoCapitalize="sentences"
        spellCheck
        enterKeyHint="go"
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => submitOnPlainEnter(event, compositionEndAt)}
        onCompositionEnd={(event) => {
          compositionEndAt.current = event.timeStamp;
        }}
      />
      <StudioPromptActions
        copy={copy}
        busy={busy}
        trimmed={trimmed}
        stoppable={stoppable}
        stopLabel={stopLabel}
        onStop={onStop}
        showStartOver={showStartOver}
        onStartOver={onStartOver}
      />
      <StudioTunes {...props} />
    </form>
  );
}

/**
 * Native fullscreen paints only the canvas surface, so the studio's own top
 * bar vanishes in it. The one control a viewer needs in there — the way
 * out — is portaled into the surface itself, in the same corner the desk's
 * fullscreen toolbar uses.
 */
function StudioFullscreenExit({ isFullscreen, diagramSurfaceRef, copy, onToggleFullscreen }) {
  const [host, setHost] = useState(null);

  useLayoutEffect(() => {
    if (!isFullscreen) {
      setHost(null);
      return undefined;
    }
    const node = diagramSurfaceRef?.current ?? null;
    setHost(node);
    return undefined;
  }, [isFullscreen, diagramSurfaceRef]);

  if (!isFullscreen || !host) return null;
  const label = copy.exitFullscreen ?? 'Exit fullscreen';
  return createPortal(
    <div className="diagram-fullscreen-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="diagram-fullscreen-close"
        title={label}
        aria-label={label}
        data-testid="simple-studio-fullscreen-exit"
        onClick={() => onToggleFullscreen?.()}
      >
        <svg
          className="diagram-fullscreen-close-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 6l12 12M18 6 6 18"
          />
        </svg>
      </button>
    </div>,
    host
  );
}

/**
 * First-run prompt. One field, one result, and the same top bar the desk
 * carries — so Simple and Office read as two views of one place.
 */
export function SimpleStudioSlot(props) {
  const headline = props.copy.headline ?? FALLBACK_HEADLINE;
  return (
    <section
      className={`simple-studio${props.showCanvas ? ' is-result' : ''}`}
      data-testid="simple-studio"
      aria-busy={props.busy || undefined}
    >
      <StudioTopBar {...props} />
      {props.showCanvas ? (
        <>
          <StudioResult {...props} />
          <StudioFullscreenExit {...props} copy={props.copy} />
        </>
      ) : null}
      <StudioThinkingPeek
        copy={props.copy}
        busy={Boolean(props.busy)}
        status={props.status}
        lines={props.thinkingLines ?? []}
      />
      <StudioPromptForm {...props} headline={headline} />
      <ErrorToast />
    </section>
  );
}
