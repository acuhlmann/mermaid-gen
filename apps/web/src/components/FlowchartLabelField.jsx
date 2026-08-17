import { useEffect, useRef } from 'react';

/**
 * Tiny overlay field for renaming a flowchart node or edge after Connect / Rename.
 */
export default function FlowchartLabelField({ session, placeholder, onCommit, onCancel }) {
  const inputRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [session?.logicalId, session?.fromId, session?.toId]);

  if (!session) return null;

  function finish(value, cancelled) {
    if (doneRef.current) return;
    doneRef.current = true;
    if (cancelled) onCancel?.();
    else onCommit?.(value);
  }

  return (
    <form
      className="flowchart-label-field"
      style={{ left: session.x, top: session.y }}
      onSubmit={(event) => {
        event.preventDefault();
        finish(inputRef.current?.value ?? session.draft, false);
      }}
    >
      <input
        ref={inputRef}
        defaultValue={session.draft}
        placeholder={placeholder}
        aria-label={placeholder}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            finish(session.draft, true);
          }
        }}
        onBlur={(event) => {
          finish(event.target.value, false);
        }}
      />
    </form>
  );
}
