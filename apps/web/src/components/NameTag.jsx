import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  DEFAULT_USER_NAME,
  getStoredUserName,
  setUserName,
  subscribe
} from '../state/userIdentityStore.js';
import { USER_NAME_MAX_LENGTH } from '../utils/officeAmbienceStorage.js';

/** Resolve the badge copy once, with sane English defaults for missing locales. */
function resolveNameTagCopy(copy) {
  return {
    hello: copy?.hello ?? 'HELLO',
    subtitle: copy?.subtitle ?? 'my name is',
    placeholder: copy?.placeholder ?? DEFAULT_USER_NAME,
    editTitle: copy?.editTitle ?? 'Type your name — the whole office will start using it',
    inputAria: copy?.inputAria ?? 'Your name for the office'
  };
}

/** The red header strip shared by the resting badge and the edit form. */
function NameTagHeader({ hello, subtitle }) {
  return (
    <>
      <span className="name-tag-hello">{hello}</span>
      <span className="name-tag-sub">{subtitle}</span>
    </>
  );
}

const NAME_TAG_SAVE_DEBOUNCE_MS = 300;

/** The edit form — persists on a short debounce so refresh mid-type keeps the draft. */
function NameTagEditor({ text, stored, onCommit, onCancel }) {
  const [draft, setDraft] = useState(stored);
  const inputRef = useRef(null);
  const originalRef = useRef(stored);
  const debounceRef = useRef(null);

  const persistNow = useCallback((value) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setUserName(value);
  }, []);

  const schedulePersist = useCallback((value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setUserName(value);
    }, NAME_TAG_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    schedulePersist(draft);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, schedulePersist]);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const finish = (value) => {
    persistNow(value);
    onCommit();
  };

  const cancel = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setUserName(originalRef.current);
    onCancel();
  };

  return (
    <form
      className="name-tag name-tag--editing"
      data-testid="name-tag"
      onSubmit={(event) => {
        event.preventDefault();
        finish(draft);
      }}
    >
      <NameTagHeader hello={text.hello} subtitle={text.subtitle} />
      <input
        ref={inputRef}
        className="name-tag-input"
        value={draft}
        maxLength={USER_NAME_MAX_LENGTH}
        placeholder={text.placeholder}
        aria-label={text.inputAria}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancel();
        }}
      />
    </form>
  );
}

/**
 * The new-hire lanyard: a classic "HELLO, my name is ___" sticker the user can
 * actually type their name into. It's the one place in the intro to name
 * yourself, and it's live — the instant you commit, every colleague (Linda's
 * welcome, Chad's IMs, the orientation greeting, the `{userName}` slot in every
 * canned line) starts using it, because they all read userIdentityStore.
 *
 * Blank badge → the office falls back to the default handle rather than leaving
 * you nameless. Copy is optional so the badge still renders with sane English
 * defaults when a locale bundle omits the section.
 */
export default function NameTag({ copy, autoEditWhenEmpty = false }) {
  const stored = useSyncExternalStore(subscribe, getStoredUserName, getStoredUserName);
  const [editing, setEditing] = useState(false);
  const autoOpenedRef = useRef(false);
  const text = resolveNameTagCopy(copy);

  useEffect(() => {
    if (!autoEditWhenEmpty || autoOpenedRef.current || stored) return;
    autoOpenedRef.current = true;
    setEditing(true);
  }, [autoEditWhenEmpty, stored]);

  if (editing) {
    return (
      <NameTagEditor
        text={text}
        stored={stored}
        onCommit={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <button
      type="button"
      className="name-tag"
      data-testid="name-tag"
      title={text.editTitle}
      onClick={() => setEditing(true)}
    >
      <NameTagHeader hello={text.hello} subtitle={text.subtitle} />
      <span className={`name-tag-value ${stored ? '' : 'is-placeholder'}`}>
        {stored || text.placeholder}
        <span className="name-tag-edit" aria-hidden="true">
          ✎
        </span>
      </span>
    </button>
  );
}
