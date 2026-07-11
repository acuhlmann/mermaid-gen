import type { StyleEdit } from '@archislop/shared';
import { styleEditSummaryLine } from '@archislop/shared';
import {
  ColorRamp,
  ColorSwatch,
  IconChip,
  IconReplaceRow,
  ThemeVarPill
} from '../utils/thinkingProseEnrich';
import { useUiCopy } from '../i18n/useUiLocale.js';

function StyleEditCard({ edit, index }: { edit: StyleEdit; index: number }) {
  const { controls } = useUiCopy();
  const step = edit.id ? `${edit.id}.` : `${index + 1}.`;

  if (edit.kind === 'icon_replace') {
    return (
      <li className="insights-style-edit-card is-icon-replace" data-testid="style-edit-card">
        <span className="insights-style-edit-step" aria-hidden="true">
          {step}
        </span>
        <div className="insights-style-edit-body">
          <span className="insights-style-edit-label">{controls.styleEdits.iconReplace}</span>
          <IconReplaceRow fromFa={edit.from} toEmoji={edit.to} keyPrefix={`se-${index}`} />
        </div>
      </li>
    );
  }

  if (edit.kind === 'color_shift') {
    return (
      <li className="insights-style-edit-card is-color-shift" data-testid="style-edit-card">
        <span className="insights-style-edit-step" aria-hidden="true">
          {step}
        </span>
        <div className="insights-style-edit-body">
          <span className="insights-style-edit-label">{controls.styleEdits.colorShift}</span>
          {edit.variable ? <ThemeVarPill name={edit.variable} keyPrefix={`se-${index}-v`} /> : null}
          {edit.to ? (
            <ColorRamp fromHex={edit.from} toHex={edit.to} keyPrefix={`se-${index}-r`} />
          ) : (
            <ColorSwatch hex={edit.from} keyPrefix={`se-${index}-s`} />
          )}
          {edit.toLabel && !edit.to ? (
            <span className="insights-style-edit-hint">({edit.toLabel})</span>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <li className="insights-style-edit-card is-generic" data-testid="style-edit-card">
      <span className="insights-style-edit-step" aria-hidden="true">
        {step}
      </span>
      <div className="insights-style-edit-body">
        <span className="insights-style-edit-text">{edit.text}</span>
        {/::icon\s*\(\s*fa/i.test(edit.text ?? '') ? (
          <IconChip
            faClasses={edit.text.match(/fa\s+fa-[\w-]+/i)?.[0]}
            keyPrefix={`se-${index}-g`}
          />
        ) : null}
      </div>
    </li>
  );
}

export default function StyleEditsPanel({
  styleEdits,
  onApply,
  busy = false
}: {
  styleEdits?: StyleEdit[];
  onApply?: () => void;
  busy?: boolean;
}) {
  const { controls } = useUiCopy();
  if (!Array.isArray(styleEdits) || styleEdits.length === 0) return null;

  return (
    <section
      className="insights-section insights-style-edits-section"
      aria-label={controls.styleEdits.region}
      data-testid="style-edits-panel"
    >
      <h4 className="insights-section-title">{controls.styleEdits.title}</h4>
      <ul className="insights-style-edits-list">
        {styleEdits.map((edit, idx) => (
          <StyleEditCard key={`${edit.kind}-${edit.id ?? idx}`} edit={edit} index={idx} />
        ))}
      </ul>
      {onApply ? (
        <div className="insights-style-edits-actions">
          <button
            type="button"
            className="insights-style-edits-apply-btn"
            disabled={busy}
            onClick={onApply}
            data-testid="style-edits-apply-btn"
          >
            {controls.styleEdits.apply}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function lineMatchesStyleEdit(
  line: string,
  styleEdits: StyleEdit[],
  summaries: Set<string>
): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^#{0,3}\s*visual tweaks$/i.test(t)) return true;

  const stepId = t.match(/^(\d+)[.)]\s+/)?.[1];
  if (stepId && styleEdits.some((e) => e.id === stepId)) return true;

  const stripped = t
    .replace(/^(\d+)[.)]\s+/, '')
    .replace(/^[-•*]\s+/, '')
    .trim();
  if (summaries.has(stripped.toLowerCase())) return true;

  if (/replace\s*::?\s*icon/i.test(t) && styleEdits.some((e) => e.kind === 'icon_replace'))
    return true;
  if (/#([0-9a-fA-F]{3,8})\b/i.test(t) && styleEdits.some((e) => e.kind === 'color_shift'))
    return true;
  if (
    styleEdits.some((e) => e.kind === 'color_shift' && e.variable && t.includes(e.variable)) &&
    /→|->|to\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function stripStyleEditLinesFromContent(content: string, styleEdits: StyleEdit[]): string {
  if (!content?.trim() || !styleEdits?.length) return content;
  const summaries = new Set(
    styleEdits.map((edit) => styleEditSummaryLine(edit).trim().toLowerCase())
  );
  const lines = content.split('\n');
  const filtered = lines.filter((line) => !lineMatchesStyleEdit(line, styleEdits, summaries));
  return filtered
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
