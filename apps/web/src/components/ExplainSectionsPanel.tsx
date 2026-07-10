/**
 * Server-built explain sections (AG-UI artifact `explain_sections`) — not model-authored UI.
 */

import type { ExplainSection } from '@archislop/shared';
import type { ReactNode } from 'react';

function toneClassForSectionId(id: string): string {
  if (id === 'explanation') return 'insights-tone-explain-overview';
  if (id === 'main_flows' || id === 'main_message') return 'insights-tone-explain-flows';
  if (id === 'key_entities' || id === 'key_data_points') return 'insights-tone-explain-entities';
  if (id === 'takeaways') return 'insights-tone-explain-takeaways';
  return 'insights-tone-explain-neutral';
}

export default function ExplainSectionsPanel({
  explainSections,
  renderBody
}: {
  explainSections?: {
    preamble?: string;
    sections?: ExplainSection[];
  };
  renderBody?: (text: string) => ReactNode;
}) {
  if (!explainSections?.sections?.length) return null;
  const { preamble, sections } = explainSections;

  return (
    <div className="insights-explain-sections" data-testid="explain-sections-panel">
      {preamble?.trim() ? (
        <div className="insights-explain-preamble insights-analysis-chunk">
          {renderBody?.(preamble) ?? preamble}
        </div>
      ) : null}
      {sections.map((section, idx) => (
        <section
          key={`${section.id}-${idx}`}
          className={`insights-section insights-explain-section ${toneClassForSectionId(section.id)}`}
          aria-labelledby={`explain-sec-${idx}`}
        >
          <h4
            id={`explain-sec-${idx}`}
            className="insights-section-title insights-section-title-explain"
          >
            {section.heading}
          </h4>
          <div className="insights-explain-section-body">
            {section.body?.trim() ? (renderBody?.(section.body) ?? section.body) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
