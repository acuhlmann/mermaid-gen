import { useEffect, useRef, useState } from 'react';
import IntroLocaleToggle from '../../components/IntroLocaleToggle.jsx';
import ErrorToast from '../../components/ErrorToast.jsx';
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

function StudioLocale({ locale, localeCopy, onSelectLocale, overlay }) {
  const toggle = (
    <IntroLocaleToggle
      locale={locale}
      copy={localeCopy}
      onSelectLocale={onSelectLocale}
      variant="intro"
    />
  );
  if (!overlay) return toggle;
  return <div className="simple-studio-locale is-overlay">{toggle}</div>;
}

function StudioResult({
  revisionId,
  diagramSource,
  contentType,
  rendererRefreshKey,
  streamingPreview,
  onManualEdit,
  onValidationChange,
  onFormSubmit,
  diagramSurfaceRef
}) {
  return (
    <DiagramCanvasSlot
      revisionId={revisionId}
      diagramSource={diagramSource}
      contentType={contentType}
      rendererRefreshKey={rendererRefreshKey}
      onManualEdit={onManualEdit}
      onValidationChange={onValidationChange}
      streamingPreview={streamingPreview}
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
      diagramSurfaceRef={diagramSurfaceRef}
      isFullscreen={false}
      onFormSubmit={onFormSubmit}
    />
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

function StudioPromptForm({
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
  onEnterOffice,
  onSubmit
}) {
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
      {showCanvas && status ? (
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
      <button
        type="button"
        className="simple-studio-office"
        data-testid="simple-studio-office"
        aria-describedby="simple-studio-office-hint"
        onClick={onEnterOffice}
      >
        {copy.officeCta ?? 'Unleash the coworkers'}
      </button>
      <p id="simple-studio-office-hint" className="simple-studio-office-hint">
        {copy.officeHint ?? 'A whole fake office. They have opinions and a bad floor plan.'}
      </p>
    </form>
  );
}

/**
 * First-run prompt. One field, one result, and a text door into the office.
 */
export function SimpleStudioSlot(props) {
  const headline = props.copy.headline ?? FALLBACK_HEADLINE;
  return (
    <section
      className={`simple-studio${props.showCanvas ? ' is-result' : ''}`}
      data-testid="simple-studio"
      aria-busy={props.busy || undefined}
    >
      {props.showCanvas ? (
        <>
          <StudioLocale {...props} overlay />
          <StudioResult {...props} />
        </>
      ) : (
        <div className="simple-studio-intro">
          <StudioLocale {...props} overlay={false} />
          <p className="simple-studio-wordmark">{props.copy.wordmark ?? 'archislop'}</p>
        </div>
      )}
      <StudioPromptForm {...props} headline={headline} />
      <ErrorToast />
    </section>
  );
}
