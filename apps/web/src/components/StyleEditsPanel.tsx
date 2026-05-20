import type { StyleEdit } from '@archislop/shared';
import { ColorRamp, ColorSwatch, IconChip, IconReplaceRow, ThemeVarPill } from '../utils/thinkingProseEnrich';

function StyleEditCard({ edit, index }: { edit: StyleEdit; index: number }) {
  const step = edit.id ? `${edit.id}.` : `${index + 1}.`;

  if (edit.kind === 'icon_replace') {
    return (
      <li className="insights-style-edit-card is-icon-replace" data-testid="style-edit-card">
        <span className="insights-style-edit-step" aria-hidden="true">
          {step}
        </span>
        <div className="insights-style-edit-body">
          <span className="insights-style-edit-label">Icon replace</span>
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
          <span className="insights-style-edit-label">Color shift</span>
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
          <IconChip faClasses={edit.text.match(/fa\s+fa-[\w-]+/i)?.[0]} keyPrefix={`se-${index}-g`} />
        ) : null}
      </div>
    </li>
  );
}

export default function StyleEditsPanel({ styleEdits }: { styleEdits?: StyleEdit[] }) {
  if (!Array.isArray(styleEdits) || styleEdits.length === 0) return null;

  return (
    <section
      className="insights-section insights-style-edits-section"
      aria-label="Style edits"
      data-testid="style-edits-panel"
    >
      <h4 className="insights-section-title">Visual tweaks</h4>
      <ul className="insights-style-edits-list">
        {styleEdits.map((edit, idx) => (
          <StyleEditCard key={`${edit.kind}-${edit.id ?? idx}`} edit={edit} index={idx} />
        ))}
      </ul>
    </section>
  );
}

export function stripStyleEditLinesFromContent(content: string, styleEdits: StyleEdit[]): string {
  if (!content?.trim() || !styleEdits?.length) return content;
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    const stepId = t.match(/^(\d+)[.)]\s+/)?.[1];
    if (stepId && styleEdits.some((e) => e.id === stepId)) return false;
    if (/replace\s*::?\s*icon/i.test(t) && styleEdits.some((e) => e.kind === 'icon_replace')) return false;
    if (/#([0-9a-fA-F]{3,8})\b/i.test(t) && styleEdits.some((e) => e.kind === 'color_shift')) return false;
    return true;
  });
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
