import { useEffect, useRef } from 'react';

const ACTION_KEYS = {
  r: 'refine',
  l: 'erlich',
  m: 'goMad',
  c: 'critique',
  e: 'explain',
  b: 'barker'
};

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return false;
}

/**
 * Wires single-letter hotkeys for the diagram action menu. Only fires while a
 * descriptor is active and the app isn't mid-stream; never intercepts typing.
 *
 * Uses a latest-ref so callers don't have to memoize the handlers.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled  Master gate (e.g. menu open, not busy).
 * @param {{ id?: string } | null} opts.descriptor  The currently-selected diagram part.
 * @param {(action: { id: string }, descriptor: object) => void} opts.onAction
 * @param {() => void} opts.onToggleHelp  Fired by `?`.
 */
export function useDiagramHotkeys({ enabled, descriptor, onAction, onToggleHelp }) {
  const onActionRef = useRef(onAction);
  const onToggleHelpRef = useRef(onToggleHelp);
  const descriptorRef = useRef(descriptor);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onActionRef.current = onAction;
    onToggleHelpRef.current = onToggleHelp;
    descriptorRef.current = descriptor;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    function handler(event) {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      const key = (event.key ?? '').toLowerCase();

      if (key === '?' || (event.shiftKey && key === '/')) {
        event.preventDefault();
        onToggleHelpRef.current?.();
        return;
      }

      if (!enabledRef.current || !descriptorRef.current) return;

      const actionId = ACTION_KEYS[key];
      if (!actionId) return;
      event.preventDefault();
      onActionRef.current?.({ id: actionId }, descriptorRef.current);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

export const DIAGRAM_HOTKEYS = Object.entries(ACTION_KEYS).map(([key, id]) => ({
  key: key.toUpperCase(),
  actionId: id
}));
